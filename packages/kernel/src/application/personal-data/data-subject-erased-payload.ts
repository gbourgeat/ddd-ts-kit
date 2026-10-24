/**
 * What `privacy.data-subject.erased` says: whose data was erased, and when. The opaque id of the
 * person alone: who asked is not repeated to every consumer and kept as long as the broker keeps
 * its messages, the audit trail records it, and the correlation id of the event leads to its entry.
 */
export interface DataSubjectErasedPayload {
  /** The opaque identifier of the data subject, as the request named it. */
  readonly subjectId: string;
  /** When the platform erased what it keeps of the person, as ISO text. */
  readonly erasedAt: string;
}
