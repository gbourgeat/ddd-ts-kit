import type { ExecutionContext } from '../../application/execution/execution-context';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import { here } from './here';
import type { Within } from './unit-of-work-scope';

const known = new WeakMap<ExecutionScope, WeakMap<ExecutionContext, Within>>();

/**
 * Runs a work in the execution context in progress now, whenever it runs. One function per context,
 * so that the events of two saves of the same command still leave together; the caller as it is
 * without a scope, or outside of any execution context.
 */
export function inContextOf(scope: ExecutionScope | undefined): Within {
  const context = scope?.current();

  if (scope === undefined || context === undefined) {
    return here;
  }

  const ofScope = known.get(scope) ?? new WeakMap<ExecutionContext, Within>();
  const inContext = ofScope.get(context) ?? ((work) => scope.run(context, work));

  known.set(scope, ofScope);
  ofScope.set(context, inContext);

  return inContext;
}
