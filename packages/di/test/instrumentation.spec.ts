import { describe, expect, it } from 'vitest';
import {
  CommandBus,
  DomainEventDispatcher,
  ErrorReporter,
  ExecutionScope,
  InMemoryErrorReporter,
  IntegrationEventPublisher,
  JobScheduler,
  QueryBus,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import { UseCaseGuard, defineContextModule, kernelModule, type BindingAspect, type Instrumentation } from '../src';
import { createApplication } from './support/on-container';
import { GetOrder } from './support/ordering/application/queries/get-order/get-order.query';
import { PlaceOrder } from './support/ordering/application/commands/place-order/place-order.command';
import { orderingModule } from './support/ordering/ordering.module';
import { billingModule } from './support/billing/billing.module';

/** An instrumentation that notes what it is asked to wrap and what goes through its wrappers. */
function noting(journal: string[]): Instrumentation {
  return {
    binding: (instance, { kind, context, token, className }) => {
      journal.push(`binding ${String(kind)} ${token} (${className}) of ${context}`);

      return instance;
    },
    useCase: async (_message, next, info) => {
      journal.push(`${info.kind} ${info.name} of ${String(info.context)}`);

      return next();
    },
    publisher: (publisher) => ({
      publish: async (events) => {
        journal.push(`publish ${events.map((event) => event.type).join()}`);
        await publisher.publish(events);
      },
    }),
    consumer: (handler, { consumer, context, type }) => {
      journal.push(`consumer ${consumer} of ${context} on ${type}`);

      return async (event, delivery) => {
        journal.push(`delivery ${String(delivery?.attempt)} to ${consumer}`);
        await handler(event, delivery);
      };
    },
    domainEvents: (dispatcher) => {
      journal.push('domain events');

      return dispatcher;
    },
    job: (run, { name, context }) => {
      journal.push(`job ${name} of ${context}`);

      return run;
    },
    errorReporter: (reporter) => {
      journal.push('error reporter');

      return reporter;
    },
    executionScope: () => void journal.push('execution scope'),
  };
}

const jobs = defineContextModule({
  name: 'housekeeping',
  register: (builder) =>
    void builder.job('housekeeping.sweep', { every: '1h' }).handledByFactory(() => ({ run: async () => undefined })),
});

describe('the instrumentation given to the kernel module', () => {
  it('wraps the bindings declared with a kind, as their instances are created', async () => {
    const journal: string[] = [];
    const app = createApplication({ modules: [kernelModule({ instrumentation: noting(journal) }), orderingModule] });

    await app.resolve(CommandBus).execute(new PlaceOrder('book'));

    expect(journal).toContain('binding repository OrderRepository (InMemoryOrderRepository) of ordering');
    expect(journal).toContain('binding use-case PlaceOrderHandler (PlaceOrderHandler) of ordering');
    expect(journal.filter((line) => line.startsWith('binding') && line.includes('kernel'))).toEqual([]);
  });

  it('observes each use case with the name of its bounded context, and what it publishes', async () => {
    const journal: string[] = [];
    const app = createApplication({ modules: [kernelModule({ instrumentation: noting(journal) }), orderingModule] });
    const id = await app.resolve(CommandBus).execute(new PlaceOrder('book'));

    await app.resolve(QueryBus).execute(new GetOrder(id));

    expect(journal.filter((line) => /^(command|query|publish) /.test(line))).toEqual([
      'command PlaceOrder of ordering',
      'publish ordering.order.placed',
      'query GetOrder of ordering',
    ]);
  });

  it('does not observe a use case the guard refused', async () => {
    const journal: string[] = [];

    const refusing = defineContextModule({
      name: 'access',
      register: (builder) =>
        void builder.bind(UseCaseGuard).toValue({ check: async () => Promise.reject(new Error('refused')) }),
    });

    const app = createApplication({
      modules: [kernelModule({ instrumentation: noting(journal) }), refusing, orderingModule],
    });

    await expect(app.resolve(CommandBus).execute(new PlaceOrder('book'))).rejects.toThrow('refused');
    expect(journal.filter((line) => line.startsWith('command'))).toEqual([]);
  });

  it('wraps what each consumer is subscribed with, and is told the delivery', async () => {
    const journal: string[] = [];

    const app = createApplication({
      modules: [kernelModule({ instrumentation: noting(journal) }), orderingModule, billingModule],
    });

    const event: IntegrationEvent = {
      id: 'evt-1',
      type: 'ordering.order.placed',
      version: 1,
      occurredAt: '2026-01-01T00:00:00.000Z',
      payload: { orderId: 'o1', sku: 'book' },
    };

    await app.start();
    await app.resolve(IntegrationEventPublisher).publish([event]);

    expect(journal).toContain('consumer billing.invoice-on-order-placed of billing on ordering.order.placed');
    expect(journal).toContain('delivery 1 to billing.invoice-on-order-placed');
  });

  it('wraps the dispatcher, the error reporter, the jobs, and is told the execution scope', () => {
    const journal: string[] = [];
    const errorReporter = new InMemoryErrorReporter();

    const app = createApplication({
      modules: [kernelModule({ instrumentation: noting(journal), errorReporter }), jobs],
    });

    app.resolve(DomainEventDispatcher);
    app.resolve(ErrorReporter);
    app.resolve(ExecutionScope);

    expect(
      app
        .resolve(JobScheduler)
        .describe()
        .map((job) => job.name),
    ).toEqual(['housekeeping.sweep']);

    expect(journal.filter((line) => !line.startsWith('binding'))).toEqual([
      'execution scope',
      'job housekeeping.sweep of housekeeping',
      'domain events',
      'error reporter',
    ]);
  });

  it('is nothing at all by default', async () => {
    const app = createApplication({ modules: [kernelModule(), orderingModule] });

    await expect(app.resolve(CommandBus).execute(new PlaceOrder('book'))).resolves.toEqual(expect.any(String));
  });
});

describe('an aspect a module puts around the bindings of a kind', () => {
  it('wraps every binding of that kind, in every module, the first declared outermost', async () => {
    const journal: string[] = [];

    const note =
      (label: string): BindingAspect =>
      (instance, info) => {
        journal.push(`${label} around ${info.token}`);

        return instance;
      };

    const observing = defineContextModule({
      name: 'observing',
      register(builder) {
        builder.around(['repository'], () => note('first'));
        builder.around(['repository', 'gateway'], () => note('second'));
        builder.around(['gateway'], () => note('never'));
      },
    });

    const app = createApplication({ modules: [kernelModule(), observing, orderingModule] });

    await app.resolve(CommandBus).execute(new PlaceOrder('book'));

    expect(journal).toEqual(['second around OrderRepository', 'first around OrderRepository']);
  });
});
