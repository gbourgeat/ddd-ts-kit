import { defineAspect } from './aspect.js';
import type { AdviceFactory, Aspect } from './types.js';
import { BulkheadFullError } from './errors.js';
import { stateFor, type StateScope } from './scope.js';

export interface BulkheadOptions {
  /** Calls running at once. */
  readonly maxConcurrent: number;
  /** Calls waiting for a place, in order. Default 0: beyond `maxConcurrent`, refuse at once. */
  readonly maxQueued?: number;
  /** One compartment per method (the default), or one shared by the methods of the instance. */
  readonly scope?: StateScope;
}

/**
 * Bounds how many calls run at once, so that one slow dependency cannot take every resource
 * of the process. A call beyond the bound waits when `maxQueued` allows, otherwise it is
 * refused with a `BulkheadFullError`.
 */
export function bulkhead(options: BulkheadOptions): Aspect {
  return defineAspect(bulkheadAdvice(options));
}

export function bulkheadAdvice(options: BulkheadOptions): AdviceFactory {
  if (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1) {
    throw new RangeError('bulkhead: maxConcurrent is an integer of at least 1');
  }
  const compartmentOf = stateFor(options.scope, () => new Compartment(options));
  return (joinPoint) => {
    const compartment = compartmentOf(joinPoint);
    return ({ proceed }) => compartment.run(`${joinPoint.className}.${joinPoint.method}`, proceed);
  };
}

class Compartment {
  #running = 0;
  readonly #waiting: (() => void)[] = [];

  constructor(private readonly options: BulkheadOptions) {}

  async run(operation: string, proceed: () => Promise<unknown>): Promise<unknown> {
    await this.#enter(operation);
    try {
      return await proceed();
    } finally {
      this.#leave();
    }
  }

  async #enter(operation: string): Promise<void> {
    if (this.#running < this.options.maxConcurrent) {
      this.#running += 1;
      return;
    }
    if (this.#waiting.length >= (this.options.maxQueued ?? 0)) throw new BulkheadFullError(operation);
    await new Promise<void>((resolve) => this.#waiting.push(resolve));
  }

  /** A waiting call takes the place as it is: the count of running calls does not move. */
  #leave(): void {
    const next = this.#waiting.shift();
    if (next === undefined) this.#running -= 1;
    else next();
  }
}
