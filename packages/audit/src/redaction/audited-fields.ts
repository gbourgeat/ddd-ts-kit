import type { AuditResource, Message, MessageType } from '@ddd-ts-kit/kernel';
import type { AuditProjection } from './audit-projection';
import type { AuditedField } from './audited-field';
import type { AuditedMessage } from './audited-message';
import type { MaskedField } from './masked-field';

export interface AuditedFieldsOptions<M> {
  /** The element the message is about. */
  readonly resource?: (message: M) => AuditResource;

  /** Name of the bounded context the message belongs to. */
  readonly context?: string;
}

type Field<M> = keyof M & string;

interface DeclaredFields<M> {
  readonly plain: readonly Field<M>[];
  readonly toMask: readonly MaskedField<Field<M>, Field<M>, M>[];
}

/**
 * Declares, next to the use case and without touching it, which fields of a command or query
 * go into its audit entry: `auditedFields(RescheduleCommand, ['status', masked('patientEmail', {
 * subject: 'patientId' })])`. A field that is not listed is never recorded; a masked one may say
 * whose value it is, which a masker keyed per data subject needs.
 */
export function auditedFields<M extends Message>(
  type: MessageType<M>,
  fields: readonly AuditedField<Field<M>, M>[],
  options: AuditedFieldsOptions<M> = {},
): AuditedMessage {
  const plain = fields.filter((field) => typeof field === 'string');
  const toMask = fields.filter((field) => typeof field !== 'string');

  return {
    type,
    masks: toMask.length > 0,
    subjectless: toMask
      .filter(({ subject, subjectOf }) => subject === undefined && subjectOf === undefined)
      .map(({ field }) => field),
    project: (message) => (message instanceof type ? projectionOf(message, { plain, toMask }, options) : {}),
  };
}

function projectionOf<M>(message: M, fields: DeclaredFields<M>, options: AuditedFieldsOptions<M>): AuditProjection {
  const resource = options.resource?.(message);
  const subjects = subjectsOf(message, fields.toMask);

  return {
    plain: Object.fromEntries(fields.plain.map((field) => [field, message[field]])),
    masked: Object.fromEntries(fields.toMask.map(({ field }) => [field, message[field]])),
    ...(Object.keys(subjects).length === 0 ? {} : { subjects }),
    ...(resource === undefined ? {} : { resource }),
    ...(options.context === undefined ? {} : { context: options.context }),
  };
}

/** The data subject of each masked field that names one, when the message holds an id for it. */
function subjectsOf<M>(message: M, toMask: readonly MaskedField<Field<M>, Field<M>, M>[]): Record<string, string> {
  const subjects: Record<string, string> = {};

  for (const { field, subject, subjectOf } of toMask) {
    const id = subjectOf === undefined ? (subject === undefined ? undefined : message[subject]) : subjectOf(message);

    if (typeof id === 'string') {
      subjects[field] = id;
    }
  }

  return subjects;
}
