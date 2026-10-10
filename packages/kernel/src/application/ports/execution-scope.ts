import type { ExecutionContext } from '../execution/execution-context.js';

/**
 * The execution context of the work in progress, for infrastructure and cross-cutting code
 * that is not handed it: loggers, audit columns, tenant scoping, outgoing headers. Set once at
 * the boundary with `run`. Use cases and the domain never read it: they receive what they need
 * in the command or query.
 */
export abstract class ExecutionScope {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.ExecutionScope' });
  }

  abstract current(): ExecutionContext | undefined;

  /** Throws `NoExecutionContextError` outside of `run`. */
  abstract require(): ExecutionContext;

  abstract run<T>(context: ExecutionContext, work: () => T): T;
}
