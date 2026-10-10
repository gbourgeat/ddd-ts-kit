import type { CircuitBreakerOptions } from '../circuit-breaker/circuit-breaker-options.js';
import { circuitBreakerAdvice } from '../circuit-breaker/circuit-breaker.js';
import type { AsyncMethodDecorator } from './async-method-decorator.js';
import { decoratorOf } from './decorator-of.js';

/** See `circuitBreaker`. One circuit per instance and method, or per instance with `scope`. */
export function CircuitBreaker(options: CircuitBreakerOptions): AsyncMethodDecorator {
  return decoratorOf(circuitBreakerAdvice(options));
}
