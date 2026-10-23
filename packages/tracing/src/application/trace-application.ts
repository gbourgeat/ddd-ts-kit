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
import { configureTracing } from '../configuration/configure-tracing';
import { tracedErrorReporter } from '../correlation/traced-error-reporter';
import { traceBindings, type TracedBinding } from '../dependency/trace-bindings';
import { tracedDomainEvents } from '../domain-events/traced-domain-events';
import type { ConsumerTrace } from '../events/consumer-trace';
import { tracedConsumer } from '../events/traced-consumer';
import { tracedPublisher } from '../events/traced-publisher';
import { tracedBackgroundJob } from '../jobs/traced-background-job';
import { tracedJob } from '../jobs/traced-job';
import { captureTraceparent } from '../propagation/capture-traceparent';
import { traceUseCases } from '../use-case/trace-use-cases';

export interface TraceApplicationOptions {
  /**
   * How a consumed event relates to its publication. Default `continue`: the consumers are
   * children of the publication, so one action is one trace. `link` starts a trace per
   * delivery, linked to it.
   */
  readonly consumers?: ConsumerTrace;
}

type JobRun = (execution: JobExecution) => Promise<void>;

type BackgroundJobRun = (payload: unknown, execution: BackgroundJobExecution) => Promise<void>;

/** The wrappers `kernelModule({ instrumentation })` of `@ddd-ts-kit/di` applies, one per kind of span. */
export interface TracedApplication {
  readonly binding: <T>(instance: T, binding: TracedBinding) => T;
  readonly useCase: BusMiddleware;
  readonly publisher: (publisher: IntegrationEventPublisher) => IntegrationEventPublisher;
  readonly consumer: (
    handler: IntegrationEventCallback,
    consumer: { readonly consumer: string; readonly context: string },
  ) => IntegrationEventCallback;
  readonly domainEvents: (dispatcher: DomainEventDispatcher) => DomainEventDispatcher;
  readonly job: (run: JobRun, job: { readonly name: string; readonly context: string }) => JobRun;
  readonly backgroundJob: (
    run: BackgroundJobRun,
    job: { readonly name: string; readonly context: string },
  ) => BackgroundJobRun;
  readonly traceparent: () => string | undefined;
  readonly errorReporter: (reporter: ErrorReporter) => ErrorReporter;
  readonly executionScope: (scope: ExecutionScope) => void;
}

/**
 * Everything that traces an application, in one value: `kernelModule({ instrumentation:
 * traceApplication() })`. Use cases, repositories and adapters, the dispatch of domain events
 * and their handlers, the outbox, the publications, the consumers, the jobs and the background jobs each get their
 * span; error reports carry the trace id, and the execution scope of the application is given
 * to `configureTracing`, so spans and log fields carry the correlation id.
 */
export function traceApplication(options: TraceApplicationOptions = {}): TracedApplication {
  const trace = options.consumers ?? 'continue';

  return {
    binding: traceBindings(),
    useCase: traceUseCases(),
    publisher: (publisher) => tracedPublisher(publisher),
    consumer: (handler, { consumer, context }) => tracedConsumer(handler, { consumer, context, trace }),
    domainEvents: tracedDomainEvents,
    job: tracedJob,
    backgroundJob: tracedBackgroundJob,
    traceparent: captureTraceparent,
    errorReporter: tracedErrorReporter,
    executionScope: (executionScope) => {
      configureTracing({ executionScope });
    },
  };
}
