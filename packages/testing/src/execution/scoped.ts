import type { ExecutionContext, ExecutionScope } from '@ddd-ts-kit/kernel';
import type { Resolvable } from '../builders/resolvable';
import { resolve } from '../builders/resolve';

/**
 * Runs a block inside an execution context, given as a value or as a builder:
 * `await scoped(scope, anExecutionContext().as(ada), () => repository.save(order))`.
 */
export function scoped<T>(
  scope: ExecutionScope,
  context: ExecutionContext | Resolvable<ExecutionContext>,
  work: () => T,
): T {
  return scope.run(resolve(context), work);
}
