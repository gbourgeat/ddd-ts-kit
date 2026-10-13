import type { ExecutionContext } from '@ddd-ts-kit/kernel';

/**
 * What the `onGuardRefusal` hook of `@ddd-ts-kit/http` hands over, restated structurally so that
 * this package does not depend on it. Any `GuardRefusal` fits.
 */
export interface GuardRefusalOfARoute {
  readonly operationId: string;
  readonly problem: { readonly code?: string; readonly status: number };
  readonly execution: ExecutionContext;
}
