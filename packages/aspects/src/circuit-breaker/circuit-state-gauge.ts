import type { Metrics } from '@ddd-ts-kit/kernel';
import { metricsOr } from '../runtime/metrics-or.js';
import type { CircuitStateChange } from './circuit-state-change.js';
import type { CircuitState } from './circuit-state.js';

const STATE_VALUES: Readonly<Record<CircuitState, number>> = { closed: 0, 'half-open': 1, open: 2 };

/**
 * An `onStateChange` that publishes the state as a gauge: 0 closed, 1 half-open, 2 open,
 * labelled `class`, `method` and `context`. The metrics default to those of the aspect runtime.
 */
export function circuitStateGauge(
  metrics?: Metrics,
  name = 'circuit_breaker_state',
): (change: CircuitStateChange) => void {
  return (change) => {
    metricsOr(metrics)
      .gauge(name)
      .set(STATE_VALUES[change.to], { class: change.className, method: change.method, context: change.context });
  };
}
