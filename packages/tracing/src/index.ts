export type { DependencyKind } from '@ddd-ts-kit/kernel';
export {
  configureTracing,
  resetTracingConfiguration,
} from './configuration/configure-tracing.js';
export { DEFAULT_LIFECYCLE_HOOKS } from './configuration/default-lifecycle-hooks.js';
export type { TracingConfiguration } from './configuration/tracing-configuration.js';
export { correlationIdFromActiveSpan } from './correlation/correlation-id-from-active-span.js';
export { traceLogFields, type TraceLogFields } from './correlation/trace-log-fields.js';
export { traceBindings, type TracedBinding } from './dependency/trace-bindings.js';
export { traceDependency, type TraceDependencyOptions } from './dependency/trace-dependency.js';
export { traceUseCase, type TraceUseCaseOptions } from './dependency/trace-use-case.js';
export { tracedPublisher } from './events/traced-publisher.js';
export { tracedSubscriber } from './events/traced-subscriber.js';
export { DROPPED_SPANS_ATTRIBUTE } from './local-root/admit-dependency-span.js';
export { CORRELATION_ID_ATTRIBUTE, ORIGIN_ATTRIBUTE } from './local-root/correlate.js';
export { LocalRootTracker } from './local-root/local-root-tracker.js';
export type { EndedSpan } from './processors/ended-span.js';
export { ErrorMessageScrubber } from './processors/error-message-scrubber.js';
export { UrlSecretSpanProcessor } from './processors/url-secret-span-processor.js';
export { captureTraceparent } from './propagation/capture-traceparent.js';
export { runWithTraceparent } from './propagation/run-with-traceparent.js';
export { spanContextFromTraceparent } from './propagation/span-context-from-traceparent.js';
export { traceparentFromContext } from './propagation/traceparent-from-context.js';
export { withSpan } from './span/with-span.js';
