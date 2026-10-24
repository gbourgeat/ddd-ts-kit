import type { DataSubjectExport } from './data-subject-export';
import { isDataSubjectId } from './is-data-subject-id';
import { NotADataSubjectIdError } from './not-a-data-subject-id-error';
import type { PersonalDataExportDocument } from './personal-data-export-document';
import { PERSONAL_DATA_EXPORT_FORMAT } from './personal-data-export-format';
import type { PersonalDataRecord } from './personal-data-record';
import { UnknownDataSubjectError } from './unknown-data-subject-error';

/**
 * The right of access and to portability of one data subject (GDPR articles 15 and 20): every
 * record each context keeps of the person, in every tenant, gathered into one dated document.
 * The exports run one after the other, in the order they are listed, so that a document reads the
 * same from one run to the next; an export that fails stops the gathering, since a document that
 * silently lacks a context would state less than the system keeps. A subject that is not an opaque
 * identifier is refused before anything is read: an export looks a person up by id, never by a
 * name or an email, which would be a search in personal data. Give it the exports wrapped by
 * `auditedPersonalDataExport` of `@ddd-ts-kit/audit`, so that every handover leaves a dated entry
 * naming who read what of whom, and never the values.
 */
export async function exportDataSubject(
  subject: string,
  parts: DataSubjectExport,
): Promise<PersonalDataExportDocument> {
  if (!isDataSubjectId(subject)) {
    throw new NotADataSubjectIdError();
  }

  const records = await gatherRecords(subject, parts);

  if (records.length === 0 && parts.isKnown !== undefined && !(await parts.isKnown(subject))) {
    throw new UnknownDataSubjectError(subject);
  }

  return { format: PERSONAL_DATA_EXPORT_FORMAT, subject, exportedAt: parts.clock.now(), records };
}

async function gatherRecords(subject: string, parts: DataSubjectExport): Promise<PersonalDataRecord[]> {
  const { exports = [], inEveryTenant = (work) => work() } = parts;
  const records: PersonalDataRecord[] = [];

  for (const port of exports) {
    records.push(...(await inEveryTenant(() => port.exportOf(subject))));
  }

  return records;
}
