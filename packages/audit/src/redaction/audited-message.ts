import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuditProjection } from './audit-projection';

/** The declaration of one command or query, read by `auditMiddleware`. */
export interface AuditedMessage {
  readonly type: MessageType<Message>;

  readonly masks: boolean;

  project(message: Message): AuditProjection;
}
