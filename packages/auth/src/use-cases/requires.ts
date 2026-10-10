import type { Actored, Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuthorizationContext } from '../authorization/authorization-context.js';
import type { ResourceRef } from '../authorization/resource-ref.js';
import type { Permission } from '../permissions/permission.js';
import type { ProtectedUseCase } from './use-case-declaration.js';

export interface RequirementOptions<M> {
  /** The element the message is about, when the right depends on it. */
  readonly resource?: (message: M) => ResourceRef;
  /** Facts of the message the authorizer may need, such as the tenant it targets. */
  readonly context?: (message: M) => AuthorizationContext;
}

/**
 * Declares, next to the use case and without touching its handler, the permission a command
 * or query requires. The message must carry its actor, which the compiler checks.
 */
export function requires<M extends Message & Actored>(
  type: MessageType<M>,
  permission: Permission,
  options: RequirementOptions<M> = {},
): ProtectedUseCase {
  return {
    access: 'protected',
    type,
    permission,
    resourceOf: (message) => (message instanceof type ? options.resource?.(message) : undefined),
    contextOf: (message) => (message instanceof type ? options.context?.(message) : undefined),
  };
}
