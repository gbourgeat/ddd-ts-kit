import type { CircuitState } from './circuit-state.js';

export interface CircuitStateChange {
  readonly className: string;
  /** Absent when the circuit is shared by the methods of the instance. */
  readonly method?: string;
  readonly context?: string;
  readonly from: CircuitState;
  readonly to: CircuitState;
}
