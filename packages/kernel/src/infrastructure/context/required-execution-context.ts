import type { ExecutionContext } from '../../application/execution/execution-context';
import { NoExecutionContextError } from '../../application/execution/no-execution-context-error';

export function requiredExecutionContext(context: ExecutionContext | undefined): ExecutionContext {
  if (context === undefined) {
    throw new NoExecutionContextError();
  }

  return context;
}
