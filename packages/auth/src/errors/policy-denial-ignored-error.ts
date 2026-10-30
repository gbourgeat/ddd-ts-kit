import type { MessageInfo } from '@ddd-ts-kit/kernel';

/**
 * A handler answered with a success after `Access` denied the permission of its use case, which a
 * policy refines, or failed to answer it, and no later question on it was allowed: the decision
 * was asked and its answer not acted on. A failed `Result` or a throw is the handler stopping. A programming error, not a refusal: it must fail a test, never be answered as a 403.
 */
export class PolicyDenialIgnoredError extends Error {
  constructor(info: MessageInfo, permissionId: string) {
    super(
      `The ${info.kind} ${info.name} requires ${permissionId}, which a policy refines, and its handler answered with a success after Access denied it. Stop on a denied decision, or call access.authorize(actor, permission, element), which refuses it, before the change.`,
    );

    this.name = 'PolicyDenialIgnoredError';
  }
}
