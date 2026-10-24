import type { MaskedField } from './masked-field';

export interface MaskedFieldOptions<Subject extends string, M> {
  /** Whose value it is: the field of the message that holds the opaque id of the data subject. */
  readonly subject?: Subject;
  /** Whose value it is, when no single field holds the id: a function of the message. */
  readonly subjectOf?: (message: M) => string;
}

/**
 * `masked('patientEmail')`: the value is stored as a keyed hash. `masked('patientEmail', { subject:
 * 'patientId' })` says whose it is, which a masker keyed per data subject needs.
 */
export function masked<Name extends string, Subject extends string = never, M = unknown>(
  field: Name,
  options: MaskedFieldOptions<Subject, M> = {},
): MaskedField<Name, Subject, M> {
  return {
    field,
    masked: true,
    ...(options.subject === undefined ? {} : { subject: options.subject }),
    ...(options.subjectOf === undefined ? {} : { subjectOf: options.subjectOf }),
  };
}
