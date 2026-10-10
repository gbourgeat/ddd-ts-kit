import { trace, type Tracer } from '@opentelemetry/api';

const TRACER_NAME = '@ddd-ts-kit/tracing';

/** Looked up on every use so a provider registered after wrapping is still honoured. */
export function tracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}
