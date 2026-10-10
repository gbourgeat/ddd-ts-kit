export type { DependencyKind } from '@ddd-ts-kit/kernel';
export {
  traceApplication,
  type TraceApplicationOptions,
  type TracedApplication,
} from './application/trace-application.js';
export { configureTracing, resetTracingConfiguration } from './configuration/configure-tracing.js';
export { DEFAULT_LIFECYCLE_HOOKS } from './configuration/default-lifecycle-hooks.js';
export type { TracingConfiguration } from './configuration/tracing-configuration.js';
export { correlationIdFromActiveSpan } from './correlation/correlation-id-from-active-span.js';
export { traceLogFields, type TraceLogFields } from './correlation/trace-log-fields.js';
export { tracedErrorReporter } from './correlation/traced-error-reporter.js';
export { traceBindings, type TracedBinding } from './dependency/trace-bindings.js';
export { traceDependency, type TraceDependencyOptions } from './dependency/trace-dependency.js';
export { tracedDomainEvents } from './domain-events/traced-domain-events.js';
export type { ConsumerTrace } from './events/consumer-trace.js';
export { ATTEMPT_ATTRIBUTE, tracedConsumer, type TracedConsumerOptions } from './events/traced-consumer.js';
export { tracedPublisher, type TracedPublisherOptions } from './events/traced-publisher.js';
export { tracedSubscriber, type TracedSubscriberOptions } from './events/traced-subscriber.js';
export { isNoisePath } from './http/is-noise-path.js';
export { isNoiseRoute } from './http/is-noise-route.js';
export { NOISE_PATHS } from './http/noise-paths.js';
export { tracedRoutes, type TracedResponse, type TracedRoute, type TracedRoutesOptions } from './http/traced-routes.js';
export { tracedJob, type TracedJobOptions } from './jobs/traced-job.js';
export { DROPPED_SPANS_ATTRIBUTE } from './local-root/admit-dependency-span.js';
export { CORRELATION_ID_ATTRIBUTE, ORIGIN_ATTRIBUTE } from './local-root/correlate.js';
export { LocalRootTracker } from './local-root/local-root-tracker.js';
export { AttributeAllowList, type AttributeAllowListOptions } from './processors/attribute-allow-list.js';
export { DEFAULT_ALLOWED_ATTRIBUTES } from './processors/default-allowed-attributes.js';
export type { EndedSpan } from './processors/ended-span.js';
export { ErrorMessageScrubber } from './processors/error-message-scrubber.js';
export { UrlSecretSpanProcessor } from './processors/url-secret-span-processor.js';
export { captureTraceparent } from './propagation/capture-traceparent.js';
export { runWithTraceparent } from './propagation/run-with-traceparent.js';
export { spanContextFromTraceparent } from './propagation/span-context-from-traceparent.js';
export { traceparentFromContext } from './propagation/traceparent-from-context.js';
export { OUTCOME_ATTRIBUTE } from './span/outcome-attribute.js';
export { withSpan } from './span/with-span.js';
export { traceUseCases } from './use-case/trace-use-cases.js';
