import type { Clock, Metrics } from '@ddd-ts-kit/kernel';
import { defineAspect } from './aspect.js';
import type { AdviceFactory, Aspect, JoinPoint } from './types.js';
import { CircuitOpenError, isBusinessRefusal } from './errors.js';
import { safely } from './observe.js';
import { clockOr, metricsOr } from './runtime.js';
import { stateFor, type StateScope } from './scope.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitStateChange {
  readonly className: string;
  /** Absent when the circuit is shared by the methods of the instance. */
  readonly method?: string;
  readonly context?: string;
  readonly from: CircuitState;
  readonly to: CircuitState;
}

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

type Subject = Omit<CircuitStateChange, 'from' | 'to'>;

function subjectOf(joinPoint: JoinPoint, options: CircuitBreakerOptions): Subject {
  return {
    className: joinPoint.className,
    ...(options.scope === 'instance' ? {} : { method: joinPoint.method }),
    ...(joinPoint.context === undefined ? {} : { context: joinPoint.context }),
  };
}

class Circuit {
  #state: CircuitState = 'closed';
  #failures = 0;
  #openedAt = 0;
  #trials = 0;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly subject: Subject,
  ) {}

  async run(clock: Clock, proceed: () => Promise<unknown>): Promise<unknown> {
    this.#admit(clock);
    try {
      const result = await proceed();
      this.#answered();
      return result;
    } catch (error) {
      if ((this.options.isFailure ?? isFault)(error)) this.#failed(clock);
      else this.#answered();
      throw error;
    }
  }

  #admit(clock: Clock): void {
    if (this.#state === 'closed') return;
    const retryAt = this.#openedAt + this.options.resetAfterMs;
    if (this.#state === 'open' && clock.now().getTime() >= retryAt) this.#become('half-open');
    if (this.#state === 'open' || this.#trials >= (this.options.halfOpenMax ?? 1)) {
      throw new CircuitOpenError(this.#operation(), new Date(retryAt));
    }
    this.#trials += 1;
  }

  #answered(): void {
    this.#failures = 0;
    if (this.#state === 'half-open') this.#become('closed');
  }

  #failed(clock: Clock): void {
    if (this.#state === 'open') return;
    this.#failures += 1;
    if (this.#state === 'half-open' || this.#failures >= this.options.failureThreshold) {
      this.#openedAt = clock.now().getTime();
      this.#become('open');
    }
  }

  #become(state: CircuitState): void {
    const change = { ...this.subject, from: this.#state, to: state };
    this.#state = state;
    this.#trials = 0;
    if (state === 'closed') this.#failures = 0;
    safely(() => this.options.onStateChange?.(change));
  }

  #operation(): string {
    const { className, method } = this.subject;
    return method === undefined ? className : `${className}.${method}`;
  }
}

function isFault(error: unknown): boolean {
  return !isBusinessRefusal(error);
}
