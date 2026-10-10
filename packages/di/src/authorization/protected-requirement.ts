import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { PermissionRef } from '@ddd-ts-kit/kernel/declarations';
import type { RequirementOptions } from './requirement-options.js';
import type { Requirement } from './requirement.js';

export function protectedRequirement<M extends Message>(
  type: MessageType<M>,
  permission: PermissionRef,
  options: RequirementOptions<M> = {},
): Requirement {
  return {
    access: 'protected',
    permission,
    resourceOf: (message) => (message instanceof type ? options.resource?.(message) : undefined),
    contextOf: (message) => (message instanceof type ? options.context?.(message) : undefined),
  };
}
