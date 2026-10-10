import type { Message } from '../../application/messaging/message.js';
import type { PermissionRef } from './permission-ref.js';
import type { ResourcePointer } from './resource-pointer.js';

/** Who may send a command or a query, as data. */
export interface AccessDeclaration {
  readonly access: 'public' | 'protected';
  readonly permission?: PermissionRef;
  readonly resourceOf?: (message: Message) => ResourcePointer | undefined;
  readonly contextOf?: (message: Message) => Readonly<Record<string, unknown>> | undefined;
}
