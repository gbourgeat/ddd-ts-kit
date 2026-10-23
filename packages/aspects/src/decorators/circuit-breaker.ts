import type { CircuitBreakerOptions } from '../circuit-breaker/circuit-breaker-options';
import { circuitBreakerAdvice } from '../circuit-breaker/circuit-breaker';
import type { AsyncMethodDecorator } from './async-method-decorator';
import { decoratorOf } from './decorator-of';

/** See `circuitBreaker`. One circuit per instance and method, or per instance with `scope`. */
export function CircuitBreaker(options: CircuitBreakerOptions): AsyncMethodDecorator {
  return decoratorOf(circuitBreakerAdvice(options));
}
