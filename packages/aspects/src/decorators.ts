import type { AdviceFactory } from './types.js';
import { bulkheadAdvice, type BulkheadOptions } from './bulkhead.js';
import { cachedAdvice, type CachedOptions } from './cached.js';
import { circuitBreakerAdvice, type CircuitBreakerOptions } from './circuit-breaker.js';
import { loggedAdvice, type LoggedOptions } from './logged.js';
import { retryAdvice, type RetryOptions } from './retry.js';
import { timedAdvice, type TimedOptions } from './timed.js';
import { timeoutAdvice, type TimeoutOptions } from './timeout.js';
import { adviseMethod } from './weave.js';

type AsyncMethod<This, Args extends unknown[], Result> = (this: This, ...args: Args) => Promise<Result>;

/**
 * A standard (TC39) decorator of a public instance method that answers a promise. Several on
 * one method nest as they read: the one written first is outermost.
 */
export type AsyncMethodDecorator = <This extends object, Args extends unknown[], Result>(
  target: AsyncMethod<This, Args, Result>,
  context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, Result>>,
) => void;

/** For an adapter whose retry policy is part of its definition. See `retry`. */
export function Retry(options: RetryOptions): AsyncMethodDecorator {
  return decoratorOf(retryAdvice(options));
}

/** See `timeout`. */
export function Timeout(timeoutMs: number, options?: TimeoutOptions): AsyncMethodDecorator {
  return decoratorOf(timeoutAdvice(timeoutMs, options));
}

/** See `cached`. The cache comes from the aspect runtime unless given. */
export function Cached(options: CachedOptions): AsyncMethodDecorator {
  return decoratorOf(cachedAdvice(options));
}

/** See `logged`. The logger comes from the aspect runtime unless given. */
export function Logged(options?: LoggedOptions): AsyncMethodDecorator {
  return decoratorOf(loggedAdvice(options));
}

/** See `timed`. The metrics come from the aspect runtime unless given. */
export function Timed(options?: TimedOptions): AsyncMethodDecorator {
  return decoratorOf(timedAdvice(options));
}

/** See `circuitBreaker`. One circuit per instance and method, or per instance with `scope`. */
export function CircuitBreaker(options: CircuitBreakerOptions): AsyncMethodDecorator {
  return decoratorOf(circuitBreakerAdvice(options));
}

/** See `bulkhead`. */
export function Bulkhead(options: BulkheadOptions): AsyncMethodDecorator {
  return decoratorOf(bulkheadAdvice(options));
}

/**
 * The decorator form of any advice factory: each instance gets the method wrapped when it is
 * constructed, by the same code as the wrappers of the composition root.
 */
export function decoratorOf(advise: AdviceFactory): AsyncMethodDecorator {
  return (_target, context) => {
    const { name } = context;
    if (context.static || context.private || typeof name !== 'string') {
      throw new TypeError('An aspect decorates a public instance method with a string name');
    }
    context.addInitializer(function (this: object) {
      adviseMethod(this, name, advise);
    });
  };
}
