import type { AdviceFactory } from '../aspect/advice-factory.js';
import type { Aspect } from '../aspect/aspect.js';
import { defineAspect } from '../aspect/define-aspect.js';
import type { JoinPoint } from '../aspect/join-point.js';
import { clockOr } from '../runtime/clock-or.js';
import { stateFor } from '../state/state-for.js';
import type { CircuitBreakerOptions } from './circuit-breaker-options.js';
import { Circuit, type CircuitSubject } from './circuit.js';

/**
 * Stops calling a dependency that keeps failing: after `failureThreshold` consecutive failures
 * the calls are refused with a `CircuitOpenError` for `resetAfterMs`, then a trial call
 * decides whether the circuit closes again.
 */
export function circuitBreaker(options: CircuitBreakerOptions): Aspect {
  return defineAspect(circuitBreakerAdvice(options));
}

export function circuitBreakerAdvice(options: CircuitBreakerOptions): AdviceFactory {
  const circuitOf = stateFor(options.scope, (joinPoint) => new Circuit(options, subjectOf(joinPoint, options)));

  return (joinPoint) => {
    const circuit = circuitOf(joinPoint);

    return ({ proceed }) => circuit.run(clockOr(options.clock), proceed);
  };
}

function subjectOf(joinPoint: JoinPoint, options: CircuitBreakerOptions): CircuitSubject {
  return {
    className: joinPoint.className,
    ...(options.scope === 'instance' ? {} : { method: joinPoint.method }),
    ...(joinPoint.context === undefined ? {} : { context: joinPoint.context }),
  };
}
