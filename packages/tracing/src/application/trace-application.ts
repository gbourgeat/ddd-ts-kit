import type {
  BusMiddleware,
  DomainEventDispatcher,
  ErrorReporter,
  ExecutionScope,
  IntegrationEventCallback,
  IntegrationEventPublisher,
  JobExecution,
} from '@ddd-ts-kit/kernel';
import { configureTracing } from '../configuration/configure-tracing.js';
import { tracedErrorReporter } from '../correlation/traced-error-reporter.js';
import { traceBindings, type TracedBinding } from '../dependency/trace-bindings.js';
import { tracedDomainEvents } from '../domain-events/traced-domain-events.js';
import type { ConsumerTrace } from '../events/consumer-trace.js';
import { tracedConsumer } from '../events/traced-consumer.js';
import { tracedPublisher } from '../events/traced-publisher.js';
import { tracedJob } from '../jobs/traced-job.js';
import { traceUseCases } from '../use-case/trace-use-cases.js';

export interface TraceApplicationOptions {
  /**
   * How a consumed event relates to its publication. Default `continue`: the consumers are
   * children of the publication, so one action is one trace. `link` starts a trace per
   * delivery, linked to it.
   */
  readonly consumers?: ConsumerTrace;
}

type JobRun = (execution: JobExecution) => Promise<void>;

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
  readonly errorReporter: (reporter: ErrorReporter) => ErrorReporter;
  readonly executionScope: (scope: ExecutionScope) => void;
}

/**
 * Everything that traces an application, in one value: `kernelModule({ instrumentation:
 * traceApplication() })`. Use cases, repositories and adapters, the dispatch of domain events
 * and their handlers, the outbox, the publications, the consumers and the jobs each get their
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
    errorReporter: tracedErrorReporter,
    executionScope: (executionScope) => {
      configureTracing({ executionScope });
    },
  };
}
