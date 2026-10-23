import { describe, expect, it } from 'vitest';
import { ConcurrencyError, InMemoryUnitOfWork, UnreadableProcessStateError } from '@ddd-ts-kit/kernel';
import { NoTimeoutJobError, StoredProcessRunner } from '../src';
import { aProcessBench } from './support/a-process-bench';
import { CloseDunning, DunningProcess, SendPaymentReminder } from './support/dunning-process';

const DUE = new Date('2026-03-02T12:00:00.000Z');
const LATER = new Date('2026-03-03T12:00:00.000Z');

describe('a process manager run by the runner', () => {
  it('starts an instance on its first event, arms its timeout, and runs the timeout step when it is due', async () => {
    const { runner, dunning, processes, worker, clock, commands } = aProcessBench();

    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current));

    expect(processes.list()).toMatchObject([
      { name: 'billing.dunning', id: 'invoice-1', version: 1, state: { stage: 'waiting' } },
    ]);

    expect(await worker.runDue()).toEqual([]);

    clock.advance(DUE.getTime() - clock.now().getTime());
    await worker.runDue();

    expect(commands.sent).toEqual([new SendPaymentReminder('invoice-1')]);
    expect(processes.list()).toMatchObject([{ version: 2, state: { stage: 'reminded' }, timeouts: {} }]);
  });

  it('ignores the event a step ignores, and every event after the end', async () => {
    const { runner, dunning, processes, commands } = aProcessBench();

    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.paid(current));
    expect(processes.list()).toEqual([]);

    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current));
    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.paid(current));
    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.paid(current));

    expect(commands.sent).toEqual([new CloseDunning('invoice-1')]);
    expect(processes.list()).toMatchObject([{ version: 2, ended: true, timeouts: {} }]);
  });

  it('never runs a timeout that was disarmed, or replaced by a later one', async () => {
    const { runner, dunning, worker, clock, commands, store } = aProcessBench();

    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current));
    await runner.run(DunningProcess, 'invoice-2', (current) => dunning.issued('invoice-2', DUE, current));
    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.paid(current));
    await runner.run(DunningProcess, 'invoice-2', (current) => dunning.postponed(LATER, current));

    clock.advance(DUE.getTime() - clock.now().getTime());
    await worker.runDue();
    expect(commands.sent).toEqual([new CloseDunning('invoice-1')]);
    expect(store.list().map(({ status }) => status)).toEqual(['cancelled', 'cancelled', 'waiting']);

    clock.advance(LATER.getTime() - DUE.getTime());
    await worker.runDue();
    expect(commands.sent).toEqual([new CloseDunning('invoice-1'), new SendPaymentReminder('invoice-2')]);
  });

  it('lets a timeout of an instance that ended, or that is gone, pass', async () => {
    const { runner, dunning, processes, commands } = aProcessBench();
    const step = () => dunning.timedOut('reminder', { invoiceId: 'invoice-1', stage: 'waiting' });

    await runner.timeout(DunningProcess, { id: 'invoice-1', timeout: 'reminder', jobId: 'job-1' }, step);
    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current));
    await runner.timeout(DunningProcess, { id: 'invoice-1', timeout: 'reminder', jobId: 'job-9' }, step);

    expect(commands.sent).toEqual([]);
    expect(processes.list()).toMatchObject([{ version: 1 }]);
  });

  it('fails the step whose command is refused, for its event to be delivered again', async () => {
    const { runner, dunning, commands } = aProcessBench();

    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current));
    commands.refusing = (command) => command instanceof CloseDunning;

    await expect(runner.run(DunningProcess, 'invoice-1', (current) => dunning.paid(current))).rejects.toThrow(
      'refused',
    );
  });

  it('keeps the timeout armed when the step that disarmed it rolls back', async () => {
    const { runner, dunning, commands, store } = aProcessBench();

    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current));
    commands.refusing = (command) => command instanceof CloseDunning;

    await expect(runner.run(DunningProcess, 'invoice-1', (current) => dunning.paid(current))).rejects.toThrow(
      'refused',
    );

    expect(store.list().map(({ id, status }) => [id, status])).toEqual([['job-1', 'waiting']]);
  });

  it('refuses a step decided on a version another step saved in between', async () => {
    const { runner, dunning, processes } = aProcessBench();

    await runner.run(DunningProcess, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current));

    const racing = runner.run(DunningProcess, 'invoice-1', (current) => {
      void processes.save({
        name: 'billing.dunning',
        id: 'invoice-1',
        state: current,
        version: 2,
        ended: false,
        timeouts: {},
      });

      return dunning.paid(current);
    });

    await expect(racing).rejects.toThrow(ConcurrencyError);
  });

  it('refuses a state the process does not read, and a timeout without a job to deliver it', async () => {
    const { dunning, processes, queue, commands } = aProcessBench();
    const unitOfWork = new InMemoryUnitOfWork();
    const runner = new StoredProcessRunner({ store: processes, jobs: queue, commands, unitOfWork });

    await processes.save({
      name: 'billing.dunning',
      id: 'invoice-9',
      state: 'unknown',
      version: 1,
      ended: false,
      timeouts: {},
    });

    await expect(runner.run(DunningProcess, 'invoice-9', (current) => dunning.paid(current))).rejects.toThrow(
      UnreadableProcessStateError,
    );

    class Untimed extends DunningProcess {
      static override readonly timeoutJob: string | undefined = undefined;
    }

    await expect(
      runner.run(Untimed, 'invoice-1', (current) => dunning.issued('invoice-1', DUE, current)),
    ).rejects.toThrow(NoTimeoutJobError);
  });
});
