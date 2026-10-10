import { PROBE } from './probe.js';
import type { Quote } from './quote.js';

/** A fake adapter of an outside system: answers quotes, fails on demand, counts its calls. */
export class QuoteGateway {
  readonly calls: string[] = [];

  private readonly failures: unknown[] = [];

  private currentRate = 1.08;

  get rate(): number {
    return this.currentRate;
  }

  failNext(...failures: unknown[]): this {
    this.failures.push(...failures);

    return this;
  }

  async quote(pair: string): Promise<Quote> {
    this.calls.push(`quote:${pair}`);

    const failure = this.failures.shift();

    if (failure !== undefined) throw failure;

    return { pair, rate: this.currentRate };
  }

  async reprice(rate: number): Promise<void> {
    this.calls.push('reprice');
    this.currentRate = rate;
  }

  quoteLater(pair: string): Promise<Quote> {
    this.calls.push(`quoteLater:${pair}`);

    return Promise.resolve({ pair, rate: this.currentRate });
  }

  describe(): string {
    return `quotes at ${this.currentRate}`;
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
