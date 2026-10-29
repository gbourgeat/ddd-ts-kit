import type { PassportOutcome } from './passport-outcome';
import type { PassportStrategyLike } from './passport-strategy-like';

/**
 * Runs a strategy on one request as `passport.authenticate` does: a copy of the strategy whose
 * actions settle the outcome, the first one called wins. A strategy that calls none before the
 * deadline is refused, never waited on.
 */
export function runStrategy(strategy: PassportStrategyLike, raw: unknown, timeoutMs: number): Promise<PassportOutcome> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`The strategy of Passport answered nothing within ${String(timeoutMs)} ms.`));
    }, timeoutMs);

    const settle = (outcome: PassportOutcome): void => {
      clearTimeout(timer);
      resolve(outcome);
    };

    const actions = {
      success: (user: unknown, info: unknown) => settle({ kind: 'success', user, info }),
      fail: (challenge: unknown) => settle({ kind: 'fail', challenge }),
      pass: () => settle({ kind: 'pass' }),
      error: (error: unknown) => settle({ kind: 'error', error }),
      redirect: (url: unknown) => settle({ kind: 'redirect', url }),
    };

    // What else the strategy reads of itself (its verify callback, its options) comes from it.
    Reflect.setPrototypeOf(actions, strategy);

    try {
      Reflect.apply(strategy.authenticate, actions, [raw, {}]);
    } catch (error) {
      settle({ kind: 'error', error });
    }
  });
}
