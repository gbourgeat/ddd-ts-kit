import type { PersonalDataRecordEvent } from './personal-data-record-event';
import type { PersonalDataValue } from './personal-data-value';

/** What one row holds of a data subject, as an export hands it over: the source it comes from, and each personal field by name. */
export interface PersonalDataRecord {
  /** The copy the record comes from, as the erasure names it too: `identity.persons`. */
  readonly source: string;
  readonly values: Readonly<Record<string, PersonalDataValue>>;
  /** For a record of the event store: the event it comes from. */
  readonly event?: PersonalDataRecordEvent;
  /** The fields whose value could not be read (a sealed value that does not decipher): named, never left out in silence. */
  readonly unreadable?: readonly string[];
}
