import { trace, type Tracer } from '@opentelemetry/api';

const TRACER_NAME = '@ddd-ts-kit/tracing';

/** Looked up on every use so a provider registered after wrapping is still honoured. */
export function tracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/** Read without trusting the type: an object created without prototype has no constructor. */
export function constructorName(value: object): unknown {
  const constructor: unknown = Reflect.get(value, 'constructor');
  const named =
    (typeof constructor === 'object' || typeof constructor === 'function') &&
    constructor !== null &&
    'name' in constructor;
  return named ? constructor.name : undefined;
}
