import { Adapter, token, type BindingAspect } from '@ddd-ts-kit/kernel/declarations';
import { Retry } from '../../src/decorators.js';

export interface Rates {
  rate(pair: string): Promise<number>;
}

export const RATES = token<Rates>('pricing.Rates');
export const SPOT_RATES = token<Rates>('pricing.SpotRates');

const marked = new WeakSet<object>();
const attempts = new WeakMap<object, number>();

/**
 * Shaped like the class decorators of a framework: it notes the class and answers nothing, and
 * knows nothing of a decorator context.
 */
export function Marked() {
  return (target: abstract new (...args: never) => unknown): void => {
    marked.add(target);
  };
}

export function isMarked(target: object): boolean {
  return marked.has(target);
}

export function attemptsOf(rates: object): number {
  return attempts.get(rates) ?? 0;
}

export const wrapped: string[] = [];

const noting: BindingAspect = (instance, info) => {
  wrapped.push(`${info.className} as ${info.kind ?? 'nothing'} in ${info.context}`);
  return instance;
};

class Unreachable extends Error {}

abstract class FlakyRates {
  protected attempt(): number {
    const made = attemptsOf(this) + 1;
    attempts.set(this, made);
    if (made === 1) throw new Unreachable('the provider did not answer');
    return 1.08;
  }
}

@Adapter(RATES)
@Marked()
export class DeclaredThenMarked extends FlakyRates implements Rates {
  @Retry({ attempts: 3, sleep: async () => undefined })
  async rate(_pair: string): Promise<number> {
    return this.attempt();
  }
}

@Marked()
@Adapter(SPOT_RATES, { aspects: [noting] })
export class MarkedThenDeclared extends FlakyRates implements Rates {
  @Retry({ attempts: 3, sleep: async () => undefined })
  async rate(_pair: string): Promise<number> {
    return this.attempt();
  }
}
