import type { Message } from '@ddd-ts-kit/kernel';
import type { MessageHandler, PermissionRef } from '@ddd-ts-kit/kernel/declarations';
import type { RequirementOptions } from '../authorization/requirement-options.js';
import type { HandlerTarget } from './handler-target.js';
import type { UseCaseTarget } from './use-case-target.js';

/**
 * Offered only for a message that carries its actor (`AuthorizedCommand`, `AuthorizedQuery`,
 * or any message declaring `readonly actor: Actor`): a right is always somebody's.
 */
export interface ProtectedUseCaseTarget<M extends Message> extends UseCaseTarget<M> {
  /** Only an actor holding the permission reaches the handler. */
  requires(permission: PermissionRef, options?: RequirementOptions<M>): HandlerTarget<MessageHandler<M>>;
}
