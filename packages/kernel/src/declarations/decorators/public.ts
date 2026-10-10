import type { Message } from '../../application/messaging/message.js';
import type { AuditedFieldHint } from '../model/audited-field-hint.js';
import { record } from '../registry/record.js';
import { kindOf } from './kind-of.js';
import type { MessageDeclarator } from './message-declarator.js';

export interface PublicOptions<Fields extends string = never> {
  /**
   * The fields of the message that go into its audit entry, as plain data for an audit trail to
   * read: `audited: ['startsAt', { field: 'patientEmail', masked: true }]`. The compiler checks
   * that the message has them.
   */
  readonly audited?: readonly AuditedFieldHint<Fields>[];
}

/** Anybody reaches the handler, the anonymous caller included. Said, never implied. */
export function Public<const Fields extends string = never>(
  options: PublicOptions<Fields> = {},
): MessageDeclarator<Message & Record<NoInfer<Fields>, unknown>> {
  return (target) => {
    record(target, { role: 'message', kind: kindOf(target), access: 'public', audited: options.audited ?? [] });
  };
}
