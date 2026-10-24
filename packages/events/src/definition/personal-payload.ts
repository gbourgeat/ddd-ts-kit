/**
 * The fields of a payload that hold personal data, and whose: what the event catalog, the
 * AsyncAPI document (`x-personal-data`), the register and the `privacy/*` rules read. A consumer
 * that copies one of them keeps a copy of the person, which it declares with `personalFields` and
 * erases on `privacy.data-subject.erased`. Paths are written as the catalog writes them:
 * `email`, `customer.email`, `lines[].recipient`.
 */
export interface PersonalPayload {
  /** The field that names the data subject the personal fields are about: an opaque identifier, never personal data itself. */
  readonly subject: string;
  /** The fields that hold personal data of that subject. */
  readonly fields: readonly string[];
}
