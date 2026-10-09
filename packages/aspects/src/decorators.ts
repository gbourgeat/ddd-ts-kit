import type { AdviceFactory } from './types.js';
import { bulkheadAdvice, type BulkheadOptions } from './bulkhead.js';
import { cachedAdvice, type CachedOptions } from './cached.js';
import { circuitBreakerAdvice, type CircuitBreakerOptions } from './circuit-breaker.js';
import { loggedAdvice, type LoggedOptions } from './logged.js';
import { retryAdvice, type RetryOptions } from './retry.js';
import { timedAdvice, type TimedOptions } from './timed.js';
import { timeoutAdvice, type TimeoutOptions } from './timeout.js';
import { adviseMethod, advisePrototypeMethod } from './weave.js';

type AsyncMethod<This, Args extends unknown[], Result> = (this: This, ...args: Args) => Promise<Result>;

/**
 * A decorator of a public instance method that answers a promise, for both decorator modes of
 * the compiler: the standard (TC39) call `(method, context)` and the legacy
 * `experimentalDecorators` call `(prototype, name, descriptor)`. Several on one method nest as
 * they read: the one written first is outermost.
 */
export interface AsyncMethodDecorator {
  <This extends object, Args extends unknown[], Result>(
    target: AsyncMethod<This, Args, Result>,
    context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, Result>>,
  ): void;
  <Method extends (...args: never[]) => Promise<unknown>>(
    prototype: object,
    name: string | symbol,
    descriptor: TypedPropertyDescriptor<Method>,
  ): TypedPropertyDescriptor<Method> | undefined;
}

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
 * The decorator form of any advice factory, by the same code as the wrappers of the composition
 * root. In the standard mode each instance gets the method wrapped when it is constructed; in
 * the legacy mode, which has no initializer, at its first call.
 */
export function decoratorOf(advise: AdviceFactory): AsyncMethodDecorator {
  return (target: unknown, second: unknown, descriptor?: unknown): undefined => {
    if (isStandardContext(second)) adviseAtConstruction(second, advise);
    else adviseOnThePrototype({ prototype: target, name: second, descriptor }, advise);
  };
}

interface StandardContext {
  readonly kind: unknown;
  readonly name: unknown;
  readonly static: unknown;
  readonly private: unknown;
  readonly addInitializer: (initializer: (this: object) => void) => void;
}

/** The standard call hands a context object; the legacy one hands the name of the method there. */
function isStandardContext(value: unknown): value is StandardContext {
  return typeof value === 'object' && value !== null && 'kind' in value && 'addInitializer' in value;
}

function adviseAtConstruction(context: StandardContext, advise: AdviceFactory): void {
  const { name } = context;
  if (context.static === true || context.private === true || typeof name !== 'string') throw misplaced();
  context.addInitializer(function (this: object) {
    adviseMethod(this, name, advise);
  });
}

interface LegacyCall {
  readonly prototype: unknown;
  readonly name: unknown;
  readonly descriptor: unknown;
}

function adviseOnThePrototype({ prototype, name, descriptor }: LegacyCall, advise: AdviceFactory): void {
  if (typeof prototype !== 'object' || typeof name !== 'string') throw misplaced();
  if (typeof descriptor !== 'object' || descriptor === null || !('value' in descriptor)) throw misplaced();
  descriptor.value = advisePrototypeMethod(name, descriptor.value, advise);
}

function misplaced(): TypeError {
  return new TypeError('An aspect decorates a public instance method with a string name');
}
