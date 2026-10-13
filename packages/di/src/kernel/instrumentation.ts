import type {
  BackgroundJobExecution,
  BusMiddleware,
  DomainEventDispatcher,
  ErrorReporter,
  ExecutionScope,
  IntegrationEventCallback,
  IntegrationEventPublisher,
  JobExecution,
} from '@ddd-ts-kit/kernel';
import type { BindingAspect } from '@ddd-ts-kit/kernel/declarations';

/** The consumer a handler of integration events is subscribed as. */
export interface InstrumentedConsumer {
  readonly consumer: string;
  /** Name of the module that declared it. */
  readonly context: string;
  readonly type: string;
}

/** The job a run belongs to. */
export interface InstrumentedJob {
  readonly name: string;
  /** Name of the module that declared it. */
  readonly context: string;
}

/**
 * What an observability adapter puts around the application, from outside: every member is a
 * wrapper the kernel module applies where the thing is built, and none is required. An object
 * of `@ddd-ts-kit/tracing` (`traceApplication()`) fits as it is; this package knows no tracer.
 */
export abstract class Instrumentation {
  static readonly tokenKey = 'di.Instrumentation';

  /** Around every instance of a binding declared with a kind, outside the dispatch of domain events and the aspects of the binding. */
  abstract readonly binding?: BindingAspect;

  /** On both buses, after the use case guard and outside the unit of work. */
  abstract readonly useCase?: BusMiddleware;

  abstract readonly publisher?: (publisher: IntegrationEventPublisher) => IntegrationEventPublisher;

  /** Around what each consumer is subscribed with: the function the provider calls at each delivery. */
  abstract readonly consumer?: (
    handler: IntegrationEventCallback,
    consumer: InstrumentedConsumer,
  ) => IntegrationEventCallback;

  abstract readonly domainEvents?: (dispatcher: DomainEventDispatcher) => DomainEventDispatcher;

  /** Around each run of a declared job, inside its execution scope. */
  abstract readonly job?: (
    run: (execution: JobExecution) => Promise<void>,
    job: InstrumentedJob,
  ) => (execution: JobExecution) => Promise<void>;

  /** Around each attempt of a declared background job, inside its execution scope. */
  abstract readonly backgroundJob?: (
    run: (payload: unknown, execution: BackgroundJobExecution) => Promise<void>,
    job: InstrumentedJob,
  ) => (payload: unknown, execution: BackgroundJobExecution) => Promise<void>;

  /** The W3C `traceparent` of the active span, stored with each job enqueued so that its run continues the trace. */
  abstract readonly traceparent?: () => string | undefined;

  abstract readonly errorReporter?: (reporter: ErrorReporter) => ErrorReporter;

  /** Told the execution scope of the application once it is built. */
  abstract readonly executionScope?: (scope: ExecutionScope) => void;
}
