import { DomainError } from '@ddd-ts-kit/kernel';

export interface Quote {
  readonly pair: string;
  readonly rate: number;
}

/** A business refusal: the dependency answered. */
export class PairNotQuoted extends DomainError {
  readonly code = 'PAIR_NOT_QUOTED';

  constructor() {
    super('No quote for the pair asked by customer 4111-1111');
  }
}

/** A fault whose message quotes data that must never be recorded. */
export class Unreachable extends Error {
  readonly code = 'ECONNRESET';

  constructor() {
    super('Connection reset while sending card 4111-1111 to 10.0.0.7');
    this.name = 'Unreachable';
  }
}

export const PROBE = Symbol('probe');

/** A fake adapter of an outside system: answers quotes, fails on demand, counts its calls. */
export class QuoteGateway {
  readonly calls: string[] = [];
  readonly #failures: unknown[] = [];
  #rate = 1.08;

  get rate(): number {
    return this.#rate;
  }

  failNext(...failures: unknown[]): this {
    this.#failures.push(...failures);
    return this;
  }

  async quote(pair: string): Promise<Quote> {
    this.calls.push(`quote:${pair}`);
    const failure = this.#failures.shift();
    if (failure !== undefined) throw failure;
    return { pair, rate: this.#rate };
  }

  async reprice(rate: number): Promise<void> {
    this.calls.push('reprice');
    this.#rate = rate;
  }

  quoteLater(pair: string): Promise<Quote> {
    this.calls.push(`quoteLater:${pair}`);
    return Promise.resolve({ pair, rate: this.#rate });
  }

  describe(): string {
    return `quotes at ${this.#rate}`;
  }

  async onModuleInit(): Promise<string> {
    return 'initialized';
  }

  *pairs(): Generator<string> {
    yield 'EUR-USD';
  }

  async [PROBE](): Promise<string> {
    return 'probed';
  }
}

/** A fake adapter whose calls answer only when the test releases them. */
export class SlowGateway {
  readonly signals: (AbortSignal | undefined)[] = [];
  readonly #waiting: ((value: string) => void)[] = [];
  started = 0;

  async fetch(id: string, signal?: AbortSignal): Promise<string> {
    this.started += 1;
    this.signals.push(signal);
    const answer = await new Promise<string>((resolve) => this.#waiting.push(resolve));
    return `${id}:${answer}`;
  }

  async ping(): Promise<string> {
    return new Promise<string>((resolve) => this.#waiting.push(resolve));
  }

  release(answer = 'done'): void {
    this.#waiting.shift()?.(answer);
  }
}

/** Lets what is already resolved run: promise reactions, never the passage of time. */
export function settled(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
