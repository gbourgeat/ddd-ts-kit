import type { MessageInfo } from '../../application/messaging/message-info';
import type { AccessDeclaration } from './access-declaration';
import type { AuditedFieldHint } from './audited-field-hint';

export interface MessageDeclaration extends AccessDeclaration {
  readonly role: 'message';
  readonly kind: MessageInfo['kind'];
  /** Read by an audit trail: the fields of the message worth recording. Nothing else is. */
  readonly audited: readonly AuditedFieldHint[];
}
