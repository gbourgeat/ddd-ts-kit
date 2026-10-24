/**
 * A declared field whose value is stored as a keyed hash: for personal data. `subject` or
 * `subjectOf` names the data subject the value belongs to, another field of the message that holds
 * their opaque id or a function of the message, so that a masker keyed per person (`subjectMasker`)
 * knows whose key to use; the actor and the resource of the entry are rarely that person.
 */
export interface MaskedField<Name extends string = string, Subject extends string = string, M = unknown> {
  readonly field: Name;
  readonly masked: true;
  readonly subject?: Subject;
  readonly subjectOf?: (message: M) => string;
}
