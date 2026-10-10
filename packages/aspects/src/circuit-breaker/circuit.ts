import type { Clock } from '@ddd-ts-kit/kernel';
import { CircuitOpenError } from '../errors/circuit-open-error.js';
import { isBusinessRefusal } from '../errors/is-business-refusal.js';
import { safely } from '../observability/safely.js';
import type { CircuitBreakerOptions } from './circuit-breaker-options.js';
import type { CircuitStateChange } from './circuit-state-change.js';
import type { CircuitState } from './circuit-state.js';

/** What a circuit protects, as its transitions name it. */
export type CircuitSubject = Omit<CircuitStateChange, 'from' | 'to'>;

/** The state of one circuit: counts the consecutive failures, refuses while open, lets trial calls through after. */
export class Circuit {
  private state: CircuitState = 'closed';

  private failures = 0;

  private openedAt = 0;

  private trials = 0;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly subject: CircuitSubject,
  ) {}

  async run(clock: Clock, proceed: () => Promise<unknown>): Promise<unknown> {
    this.admit(clock);

    try {
      const result = await proceed();

      this.answered();

      return result;
    } catch (error) {
      if ((this.options.isFailure ?? isFault)(error)) this.failed(clock);
      else this.answered();

      throw error;
    }
  }

  private admit(clock: Clock): void {
    if (this.state === 'closed') return;

    const retryAt = this.openedAt + this.options.resetAfterMs;

    if (this.state === 'open' && clock.now().getTime() >= retryAt) this.become('half-open');

    if (this.state === 'open' || this.trials >= (this.options.halfOpenMax ?? 1)) {
      throw new CircuitOpenError(this.operation(), new Date(retryAt));
    }

    this.trials += 1;
  }

  private become(state: CircuitState): void {
    const change = { ...this.subject, from: this.state, to: state };

    this.state = state;
    this.trials = 0;

    if (state === 'closed') this.failures = 0;

    safely(() => this.options.onStateChange?.(change));
  }

  private operation(): string {
    const { className, method } = this.subject;

    return method === undefined ? className : `${className}.${method}`;
  }

  private answered(): void {
    this.failures = 0;

    if (this.state === 'half-open') this.become('closed');
  }

  private failed(clock: Clock): void {
    if (this.state === 'open') return;

    this.failures += 1;

    if (this.state === 'half-open' || this.failures >= this.options.failureThreshold) {
      this.openedAt = clock.now().getTime();
      this.become('open');
    }
  }
}

function isFault(error: unknown): boolean {
  return !isBusinessRefusal(error);
}
