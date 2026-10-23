import type { AuditResource, Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuditProjection } from './audit-projection';
import type { AuditedField } from './audited-field';
import type { AuditedMessage } from './audited-message';

export interface AuditedFieldsOptions<M> {
  /** The element the message is about. */
  readonly resource?: (message: M) => AuditResource;

  /** Name of the bounded context the message belongs to. */
  readonly context?: string;
}

interface DeclaredFields<M> {
  readonly plain: readonly (keyof M & string)[];
  readonly toMask: readonly (keyof M & string)[];
}

/**
 * Declares, next to the use case and without touching it, which fields of a command or query
 * go into its audit entry: `auditedFields(RescheduleCommand, ['status', masked('patientEmail')])`.
 * A field that is not listed is never recorded.
 */
export function auditedFields<M extends Message>(
  type: MessageType<M>,
  fields: readonly AuditedField<keyof M & string>[],
  options: AuditedFieldsOptions<M> = {},
): AuditedMessage {
  const plain = fields.filter((field) => typeof field === 'string');
  const toMask = fields.filter((field) => typeof field !== 'string').map(({ field }) => field);

  return {
    type,
    masks: toMask.length > 0,
    project: (message) => (message instanceof type ? projectionOf(message, { plain, toMask }, options) : {}),
  };
}

function projectionOf<M>(message: M, fields: DeclaredFields<M>, options: AuditedFieldsOptions<M>): AuditProjection {
  const resource = options.resource?.(message);

  return {
    plain: Object.fromEntries(fields.plain.map((field) => [field, message[field]])),
    masked: Object.fromEntries(fields.toMask.map((field) => [field, message[field]])),
    ...(resource === undefined ? {} : { resource }),
    ...(options.context === undefined ? {} : { context: options.context }),
  };
}
