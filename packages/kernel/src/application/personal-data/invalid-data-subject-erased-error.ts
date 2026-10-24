import type { PayloadIssue } from './payload-issue';

/** An erasure announced with a payload that is not one: a bug of the producer, never a value to repeat, it may be personal. */
export class InvalidDataSubjectErasedError extends Error {
  constructor(readonly issues: readonly PayloadIssue[]) {
    super(`privacy.data-subject.erased v1 has an invalid payload: ${issues.map((issue) => issue.message).join('; ')}`);

    this.name = 'InvalidDataSubjectErasedError';
  }
}
