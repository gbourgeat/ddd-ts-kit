import type { MessageInfo } from '@ddd-ts-kit/kernel';

/**
 * A handler returned without asking `Access` about the permission of its use case, which a policy
 * refines: the rule of the policy was never applied. A programming error, not a refusal: it
 * must fail a test, never be answered as a 403.
 */
export class PolicyNotAskedError extends Error {
  constructor(info: MessageInfo, permissionId: string) {
    super(
      `The ${info.kind} ${info.name} requires ${permissionId}, which a policy refines, and its handler returned without asking Access about it. Load the element, then call access.authorize(actor, permission, element) before the change.`,
    );

    this.name = 'PolicyNotAskedError';
  }
}
