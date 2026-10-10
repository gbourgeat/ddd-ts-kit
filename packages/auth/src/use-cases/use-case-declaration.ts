import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuthorizationContext } from '../authorization/authorization-context.js';
import type { ResourceRef } from '../authorization/resource-ref.js';
import type { Permission } from '../permissions/permission.js';

export interface PublicUseCase {
  readonly access: 'public';
  readonly type: MessageType<Message>;
}

export interface ProtectedUseCase {
  readonly access: 'protected';
  readonly type: MessageType<Message>;
  readonly permission: Permission;
  resourceOf(message: Message): ResourceRef | undefined;
  contextOf(message: Message): AuthorizationContext | undefined;
}

export type UseCaseDeclaration = PublicUseCase | ProtectedUseCase;
