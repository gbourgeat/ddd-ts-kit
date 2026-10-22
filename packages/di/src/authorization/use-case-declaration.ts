import type { Message, MessageInfo, MessageType } from '@ddd-ts-kit/kernel';
import type { PermissionRef, ResourcePointer } from '@ddd-ts-kit/kernel/declarations';
import type { UseCaseAccess } from './use-case-access';

export interface UseCaseDeclaration {
  readonly kind: MessageInfo['kind'];
  readonly message: MessageType<Message>;
  readonly module: string;
  /** Absent when neither the module (`.requires(...)`, `.public()`) nor the message (`@Requires`, `@Public`) said it. */
  readonly access?: UseCaseAccess;
  readonly permission?: PermissionRef;
  readonly resourceOf?: (message: Message) => ResourcePointer | undefined;
  readonly contextOf?: (message: Message) => Readonly<Record<string, unknown>> | undefined;
}
