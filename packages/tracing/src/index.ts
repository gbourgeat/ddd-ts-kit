export {
  configureTracing,
  resetTracingConfiguration,
  DEFAULT_LIFECYCLE_HOOKS,
  type DependencyKind,
  type TracingConfiguration,
} from './config.js';
export {
  traceDependency,
  traceUseCase,
  type TraceDependencyOptions,
  type TraceUseCaseOptions,
} from './trace-dependency.js';
export { withSpan } from './with-span.js';
export {
  LocalRootTracker,
  CORRELATION_ID_ATTRIBUTE,
  DROPPED_SPANS_ATTRIBUTE,
  ORIGIN_ATTRIBUTE,
} from './local-root-tracker.js';
export {
  captureTraceparent,
  traceparentFromContext,
  spanContextFromTraceparent,
  runWithTraceparent,
} from './propagation.js';
export { tracedPublisher, tracedSubscriber } from './event-bus.js';
export { UrlSecretSpanProcessor, ErrorMessageScrubber, type EndedSpan } from './span-processors.js';
export { correlationIdFromActiveSpan, traceLogFields, type TraceLogFields } from './correlation.js';
