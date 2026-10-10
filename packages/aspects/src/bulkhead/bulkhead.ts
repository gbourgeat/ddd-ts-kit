import type { AdviceFactory } from '../aspect/advice-factory.js';
import type { Aspect } from '../aspect/aspect.js';
import { defineAspect } from '../aspect/define-aspect.js';
import { stateFor } from '../state/state-for.js';
import type { BulkheadOptions } from './bulkhead-options.js';
import { Compartment } from './compartment.js';

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
