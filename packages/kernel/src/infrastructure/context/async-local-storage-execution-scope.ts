import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExecutionContext } from '../../application/execution/execution-context';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import { requiredExecutionContext } from './required-execution-context';

/** Follows the asynchronous call chain started by `run`, so concurrent requests never mix. */
export class AsyncLocalStorageExecutionScope implements ExecutionScope {
  private readonly storage = new AsyncLocalStorage<ExecutionContext>();

  current(): ExecutionContext | undefined {
    return this.storage.getStore();
  }

  require(): ExecutionContext {
    return requiredExecutionContext(this.current());
  }

  run<T>(context: ExecutionContext, work: () => T): T {
    return this.storage.run(context, work);
  }
}
