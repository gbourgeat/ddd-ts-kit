import type { PersonalDataRecord } from '../personal-data/personal-data-record';

/**
 * The right of access and to portability, for what one bounded context keeps of a person: every
 * personal field of every row about the subject, as plain data. The port of a context extends it
 * and names its source, the adapter reads the `personalFields` declarations, and a use case of
 * the platform gathers the records of every context into one document for the person.
 */
export abstract class PersonalDataExport {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.PersonalDataExport' });
  }

  abstract readonly name: string;

  /** The records about the subject in the tenant of the work, none for a subject nobody knows. */
  abstract exportOf(subject: string): Promise<readonly PersonalDataRecord[]>;
}
