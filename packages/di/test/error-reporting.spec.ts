import { describe, expect, it } from 'vitest';
import {
  CommandBus,
  DomainError,
  ErrorReporter,
  InMemoryErrorReporter,
  NoopErrorReporter,
  type ErrorReport,
} from '@ddd-ts-kit/kernel';
import { defineContextModule, fake, kernelModule } from '../src';
import { createApplication, createTestApplication } from './support/on-container';
import { lazyErrorReporter } from '../src/kernel/lazy-error-reporter';
import { PlaceOrder } from './support/ordering/application/commands/place-order/place-order.command';
import { OrderRepository } from './support/ordering/domain/repositories/order.repository';
import { orderingModule } from './support/ordering/ordering.module';

class WarehouseClosed extends DomainError {
  readonly code = 'WAREHOUSE_CLOSED';
}

const REORDER = 'ordering.reorder-stock';

function ordersFailingWith(failure: unknown) {
  return fake(OrderRepository, { save: () => Promise.reject(failure), findById: () => Promise.resolve(undefined) });
}

/** The ordering context plus a job that places an order, as a job does: by sending a command. */
const reordering = defineContextModule({
  name: 'reordering',
  register(builder) {
    builder.job(REORDER, { every: '1d' }).handledByFactory((resolve) => ({
      run: async () => void (await resolve(CommandBus).execute(new PlaceOrder('pen'))),
    }));
  },
});

describe('kernelModule', () => {
  it('binds a reporter that reports nothing until the platform gives one', () => {
    const app = createApplication({ modules: [kernelModule()] });

    expect(app.resolve(ErrorReporter)).toBeInstanceOf(NoopErrorReporter);
  });

  it('hands the unexpected failures of its buses to the reporter it is given', async () => {
    const errors = new InMemoryErrorReporter();
    const failure = new Error('connection reset');

    const app = createApplication({
      modules: [kernelModule({ errorReporter: errors }), orderingModule],
      overrides: [ordersFailingWith(failure)],
    });

    await expect(app.resolve(CommandBus).execute(new PlaceOrder('pen'))).rejects.toBe(failure);

    expect(errors.reports).toEqual([
      { error: failure, report: { origin: 'command', operation: 'PlaceOrder', severity: 'error' } },
    ]);
  });

  it('gives the reporter the time to send when the application stops, and stops all the same when it cannot', async () => {
    const flushed: number[] = [];

    const reporter: ErrorReporter = {
      report: () => undefined,
      flush: (timeoutMs) => {
        flushed.push(timeoutMs);

        return Promise.reject(new Error('tracker down'));
      },
    };

    const app = createApplication({ modules: [kernelModule({ errorReporter: reporter })] });

    await app.start();
    await expect(app.stop()).resolves.toBeUndefined();

    expect(flushed).toEqual([2_000]);
  });
});

describe('the reporter the kernel module hands to what it builds at creation', () => {
  it('reports and flushes through the reporter bound when it is called, never resolved before', async () => {
    const app = createTestApplication({ modules: [orderingModule] });
    const lazy = lazyErrorReporter((target) => app.get(target));
    const failure = new Error('boom');

    lazy.report(failure, { severity: 'error', origin: 'job', operation: REORDER });

    expect(app.errors.reports).toEqual([
      { error: failure, report: { severity: 'error', origin: 'job', operation: REORDER } },
    ]);

    await expect(lazy.flush(50)).resolves.toBe(true);
  });
});

describe('the test application', () => {
  it('lists in errors.reports the command that failed with a fault, in the execution context of the test', async () => {
    const failure = new Error('connection reset');
    const app = createTestApplication({ modules: [orderingModule], fakes: [ordersFailingWith(failure)] });

    await expect(app.commandBus.execute(new PlaceOrder('pen'))).rejects.toBe(failure);

    const expected: ErrorReport = {
      origin: 'test',
      operation: 'PlaceOrder',
      correlationId: 'test-correlation',
      actorId: 'test-user',
      severity: 'error',
    };

    expect(app.errors.reports).toEqual([{ error: failure, report: expected }]);
    expect(app.get(ErrorReporter)).toBe(app.errors);
  });

  it('lists no business refusal', async () => {
    const app = createTestApplication({
      modules: [orderingModule],
      fakes: [ordersFailingWith(new WarehouseClosed('The warehouse is closed on Sundays'))],
    });

    await expect(app.commandBus.execute(new PlaceOrder('pen'))).rejects.toBeInstanceOf(WarehouseClosed);

    expect(app.errors.reports).toEqual([]);
  });

  it('lists the failure of a job once: the command it sent reported it, the scheduler recognises it', async () => {
    const failure = new Error('connection reset');
    const app = createTestApplication({ modules: [orderingModule, reordering], fakes: [ordersFailingWith(failure)] });

    await expect(app.jobs.runNow(REORDER)).rejects.toBe(failure);

    expect(app.errors.reports).toMatchObject([
      { error: failure, report: { origin: 'schedule', operation: 'PlaceOrder', actorId: `system:${REORDER}` } },
    ]);
  });

  it('lists the failure of a job that no command reported, as the job', async () => {
    const failing = defineContextModule({
      name: 'reordering',
      register(builder) {
        builder
          .job(REORDER, { every: '1d' })
          .handledByFactory(() => ({ run: () => Promise.reject(new TypeError('x is not a function')) }));
      },
    });

    const app = createTestApplication({ modules: [failing] });

    await expect(app.jobs.runNow(REORDER)).rejects.toBeInstanceOf(TypeError);

    expect(app.errors.reports.map(({ report }) => report)).toMatchObject([
      { origin: 'schedule', operation: REORDER, context: 'ordering', actorId: `system:${REORDER}` },
    ]);
  });
});
