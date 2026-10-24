/** What `privacy.data-subject.erased` says: whose data was erased, when, and at whose request. Identifiers only, never a name. */
export interface DataSubjectErasedPayload {
  /** The opaque identifier of the data subject, as the request named it. */
  readonly subjectId: string;
  /** When the platform erased what it keeps of the person, as ISO text. */
  readonly erasedAt: string;
  /** Who asked for the erasure: the id of the actor, an operator or a system. */
  readonly requestedBy: string;
}
