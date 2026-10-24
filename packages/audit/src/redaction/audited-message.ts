import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuditProjection } from './audit-projection';

/** The declaration of one command or query, read by `auditMiddleware`. */
export interface AuditedMessage {
  readonly type: MessageType<Message>;

  readonly masks: boolean;

  /** The masked fields that name no data subject: refused at wiring time by a masker keyed per data subject. Left out: none. */
  readonly subjectless?: readonly string[];

  project(message: Message): AuditProjection;
}
