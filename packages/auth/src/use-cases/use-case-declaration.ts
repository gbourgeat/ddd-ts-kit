import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuthorizationContext } from '../authorization/authorization-context';
import type { ResourceRef } from '../authorization/resource-ref';
import type { Permission } from '../permissions/permission';

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
