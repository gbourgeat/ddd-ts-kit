export type { DependencyKind } from '@ddd-ts-kit/kernel';
export {
  traceApplication,
  type TraceApplicationOptions,
  type TracedApplication,
} from './application/trace-application';
export { configureTracing, resetTracingConfiguration } from './configuration/configure-tracing';
export { DEFAULT_LIFECYCLE_HOOKS } from './configuration/default-lifecycle-hooks';
export type { TracingConfiguration } from './configuration/tracing-configuration';
export { correlationIdFromActiveSpan } from './correlation/correlation-id-from-active-span';
export { traceLogFields, type TraceLogFields } from './correlation/trace-log-fields';
export { tracedErrorReporter } from './correlation/traced-error-reporter';
export { traceBindings, type TracedBinding } from './dependency/trace-bindings';
export { traceDependency, type TraceDependencyOptions } from './dependency/trace-dependency';
export { tracedDomainEvents } from './domain-events/traced-domain-events';
export type { ConsumerTrace } from './events/consumer-trace';
export { ATTEMPT_ATTRIBUTE, tracedConsumer, type TracedConsumerOptions } from './events/traced-consumer';
export { tracedPublisher, type TracedPublisherOptions } from './events/traced-publisher';
export { tracedSubscriber, type TracedSubscriberOptions } from './events/traced-subscriber';
export { isNoisePath } from './http/is-noise-path';
export { isNoiseRoute } from './http/is-noise-route';
export { NOISE_PATHS } from './http/noise-paths';
export { tracedRoutes, type TracedResponse, type TracedRoute, type TracedRoutesOptions } from './http/traced-routes';
export { tracedJob, type TracedJobOptions } from './jobs/traced-job';
export { tracedBackgroundJob } from './jobs/traced-background-job';
export { DROPPED_SPANS_ATTRIBUTE } from './local-root/admit-dependency-span';
export { CORRELATION_ID_ATTRIBUTE, ORIGIN_ATTRIBUTE } from './local-root/correlate';
export { LocalRootTracker } from './local-root/local-root-tracker';
export { AttributeAllowList, type AttributeAllowListOptions } from './processors/attribute-allow-list';
export { DEFAULT_ALLOWED_ATTRIBUTES } from './processors/default-allowed-attributes';
export type { EndedSpan } from './processors/ended-span';
export { ErrorMessageScrubber } from './processors/error-message-scrubber';
export { UrlSecretSpanProcessor } from './processors/url-secret-span-processor';
export { captureTraceparent } from './propagation/capture-traceparent';
export { runWithTraceparent } from './propagation/run-with-traceparent';
export { spanContextFromTraceparent } from './propagation/span-context-from-traceparent';
export { traceparentFromContext } from './propagation/traceparent-from-context';
export { OUTCOME_ATTRIBUTE } from './span/outcome-attribute';
export { withSpan } from './span/with-span';
export { traceUseCases } from './use-case/trace-use-cases';
