import type { ExecutionContext } from '@ddd-ts-kit/kernel';
import type { ErrorContext } from './error-context';

/** A request a guard of its route refused, before any use case: what `onGuardRefusal` is told. */
export interface GuardRefusal extends Omit<ErrorContext, 'execution'> {
  /** The execution context of the request: who was refused, in which session and tenant. */
  readonly execution: ExecutionContext;
}
