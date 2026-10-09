import { defineAspect } from './aspect.js';
import type { AdviceFactory, Aspect, Invocation, JoinPoint } from './types.js';
import { TimeoutError } from './errors.js';
import { schedulerOr, type Scheduler } from './runtime.js';

export interface TimeoutOptions {
  /**
   * Hands the method an `AbortSignal` as its last declared parameter, aborted when the time is
   * up, so that the underlying call is really cancelled. The method declares
   * `signal?: AbortSignal` last, without default value. A signal the caller passed there is
   * kept: either one aborts. Default false.
   */
  readonly signal?: boolean;
  /** Defaults to the scheduler of the aspect runtime. */
  readonly scheduler?: Scheduler;
}

/**
 * Rejects with a `TimeoutError` when the call has not answered in time. Without `signal` the
 * underlying call keeps running and its late outcome is dropped.
 */
export function timeout(timeoutMs: number, options: TimeoutOptions = {}): Aspect {
  return defineAspect(timeoutAdvice(timeoutMs, options));
}

export function timeoutAdvice(timeoutMs: number, options: TimeoutOptions = {}): AdviceFactory {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('timeout: the duration is a positive number of milliseconds');
  }
  return (joinPoint) => (invocation) =>
    new Promise((resolve, reject) => {
      const controller = new AbortController();
      const cancel = schedulerOr(options.scheduler).schedule(() => {
        const error = new TimeoutError(`${joinPoint.className}.${joinPoint.method}`, timeoutMs);
        controller.abort(error);
        reject(error);
      }, timeoutMs);
      const args = options.signal === true ? withSignal(invocation, joinPoint, controller.signal) : invocation.args;
      invocation.proceed(args).then(resolve, reject).finally(cancel).catch(ignored);
    });
}

function withSignal(invocation: Invocation, joinPoint: JoinPoint, signal: AbortSignal): readonly unknown[] {
  const position = joinPoint.arity - 1;
  const given = invocation.args[position];
  if (position < 0 || !(given === undefined || given instanceof AbortSignal)) return invocation.args;
  const args = [...invocation.args];
  while (args.length < position) args.push(undefined);
  args[position] = given === undefined ? signal : AbortSignal.any([given, signal]);
  return args;
}

function ignored(): void {
  return undefined;
}
