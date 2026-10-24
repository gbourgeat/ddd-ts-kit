import { describe, expect, it } from '{{tests.module}}';
import { InMemoryProcessStore, type BackgroundJob } from '@ddd-ts-kit/kernel';
import { InMemoryJobStore, QueueWorker, StoredJobQueue, StoredProcessRunner } from '@ddd-ts-kit/scheduling';
import { createTestBuses } from '@ddd-ts-kit/testing';
import { {{name.pascal}}TimeoutBackgroundJob } from '{{alias.context}}/application/background/{{name.kebab}}-timeout.background-job{{alias.ext}}';
import { {{name.pascal}}Process } from '{{alias.context}}/application/processes/{{name.kebab}}.process{{alias.ext}}';

const HOUR = 3_600_000;

describe('The timeout of {{name.words}}, when its job runs', () => {
  it('runs the step of the deadline once it is due, and not before', async () => {
    const { clock, processes, runner, worker } = arrange();
    const deadline = new Date(clock.now().getTime() + HOUR);
    const process = new {{name.pascal}}Process();
    const id = '{{name.kebab}}-1';

    await runner.run({{name.pascal}}Process, id, (current) => process.started(id, deadline, current));

    expect(await worker.runDue()).toEqual([]);

    clock.advance(HOUR);

    expect(await worker.runDue()).toMatchObject([{ job: '{{process.timeoutJob}}', outcome: 'succeeded' }]);

    expect(processes.list()).toMatchObject([{ ended: true }]);
  });
});

/** The runner, the queue of its timeouts and the worker in memory, on the clock, the buses and the unit of work of the test buses. */
function arrange() {
  const { commandBus, clock, ids, executionScope, unitOfWork } = createTestBuses();
  const store = new InMemoryJobStore();
  const processes = new InMemoryProcessStore();
  const jobQueue = new StoredJobQueue({ store, clock, ids, scope: executionScope });
  const runner = new StoredProcessRunner({ store: processes, jobs: jobQueue, commands: commandBus, unitOfWork });
  const worker = new QueueWorker({ store, clock, scope: executionScope });
  const job: BackgroundJob<unknown> = new {{name.pascal}}TimeoutBackgroundJob(runner);

  worker.register({ name: {{name.pascal}}TimeoutBackgroundJob.jobName, run: (due, execution) => job.run(due, execution) });

  return { clock, processes, runner, worker };
}
