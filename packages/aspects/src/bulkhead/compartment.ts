import { BulkheadFullError } from '../errors/bulkhead-full-error.js';
import type { BulkheadOptions } from './bulkhead-options.js';

/** The calls one bulkhead lets run at once, and those that wait for a place. */
export class Compartment {
  private readonly waiting: (() => void)[] = [];

  private running = 0;

  constructor(private readonly options: BulkheadOptions) {}

  async run(operation: string, proceed: () => Promise<unknown>): Promise<unknown> {
    await this.enter(operation);

    try {
      return await proceed();
    } finally {
      this.leave();
    }
  }

  private async enter(operation: string): Promise<void> {
    if (this.running < this.options.maxConcurrent) {
      this.running += 1;

      return;
    }

    if (this.waiting.length >= (this.options.maxQueued ?? 0)) {
      throw new BulkheadFullError(operation);
    }

    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  /** A waiting call takes the place as it is: the count of running calls does not move. */
  private leave(): void {
    const next = this.waiting.shift();

    if (next === undefined) {
      this.running -= 1;
    } else {
      next();
    }
  }
}
