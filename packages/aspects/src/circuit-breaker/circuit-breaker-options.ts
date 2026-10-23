import type { Clock } from '@ddd-ts-kit/kernel';
import type { StateScope } from '../state/state-scope';
import type { CircuitStateChange } from './circuit-state-change';

export interface CircuitBreakerOptions {
  /** Consecutive failures that open the circuit. */
  readonly failureThreshold: number;
  /** Time the circuit stays open before a trial call is let through. */
  readonly resetAfterMs: number;
  /** Trial calls let through at once while half-open. Default 1. */
  readonly halfOpenMax?: number;
  /** Defaults to the clock of the aspect runtime. */
  readonly clock?: Clock;
  /** One circuit per method (the default), or one shared by the methods of the instance. */
  readonly scope?: StateScope;
  /** Default: everything but a business refusal, which proves the dependency answers. */
  readonly isFailure?: (error: unknown) => boolean;
  /** Told every transition: see `circuitStateGauge`. */
  readonly onStateChange?: (change: CircuitStateChange) => void;
}
