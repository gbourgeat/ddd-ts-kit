import type { AuditResource } from '@ddd-ts-kit/kernel';

/**
 * What the `onDecision` hook of `@ddd-ts-kit/auth` hands over, restated structurally so that
 * this package does not depend on it. Any `DecisionRecord` fits.
 */
export interface AuthorizationDecision {
  readonly actorId: string;

  readonly permissionId: string;

  readonly resource?: AuditResource;

  readonly decision: { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

  /** The command or query the decision was taken for. */
  readonly useCase?: string;

  /** Whether that use case is a command or a query; absent for a decision taken outside a bus. */
  readonly kind?: 'command' | 'query';
}
