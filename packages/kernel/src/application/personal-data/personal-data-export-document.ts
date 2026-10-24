import type { PERSONAL_DATA_EXPORT_FORMAT } from './personal-data-export-format';
import type { PersonalDataRecord } from './personal-data-record';

/**
 * What the right of access and to portability hand over: everything the contexts keep of one data
 * subject, as plain data, in one dated document. Written as JSON, it is the structured, commonly
 * used and machine-readable form article 20 asks for; dated, it is the proof of what was handed
 * over on that day, with the entry the audited export writes. It names the subject by the opaque
 * id the request named, never by a name or an email, and each record by the source it comes from
 * (`<context>.<table>`), so that the person can tell which part of the system keeps what.
 */
export interface PersonalDataExportDocument {
  readonly format: typeof PERSONAL_DATA_EXPORT_FORMAT;
  /** The opaque identifier of the data subject, as the request named it. */
  readonly subject: string;
  /** When the records were read: what the document states is true of that instant. */
  readonly exportedAt: Date;
  /** One record per row about the subject, in every context and every tenant the export reached, each naming its source. */
  readonly records: readonly PersonalDataRecord[];
}
