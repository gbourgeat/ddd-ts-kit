import { ERASED_PERSONAL_DATA, type ExecutionScope, type FileStorage } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { ownTenantTable, type KnexContext } from '@ddd-ts-kit/knex';
import { PatientErasure } from '@/contexts/scheduling/calendars/application/ports/patient-erasure.port';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';
import type { AppointmentRow } from '@/contexts/scheduling/calendars/infrastructure/persistence/appointment-row.schema';

const APPOINTMENTS = { schema: SCHEDULING_SCHEMA, table: 'appointments' };
const AGENDA = { schema: SCHEDULING_SCHEMA, table: 'agenda' };
const PRACTITIONERS = { schema: SCHEDULING_SCHEMA, table: 'practitioners' };

/** The six columns an appointment keeps of its document, as they read without one. */
const NO_DOCUMENT = {
  document_key: null,
  document_size: null,
  document_media_type: null,
  document_checksum: null,
  document_name: null,
  document_attached_at: null,
};

type TenantTable = typeof APPOINTMENTS;
type TextRow = Readonly<Record<string, string | null>>;

/** A column of personal text, and the column that names the person the row is about. */
interface PersonalColumn {
  readonly table: TenantTable;
  readonly column: string;
  readonly ownedBy: string;
}

/** What this context keeps of a person in clear, besides the documents. */
const PERSONAL_COLUMNS: readonly PersonalColumn[] = [
  { table: APPOINTMENTS, column: 'internal_note', ownedBy: 'patient_id' },
  { table: APPOINTMENTS, column: 'cancellation_reason', ownedBy: 'patient_id' },
  { table: AGENDA, column: 'internal_note', ownedBy: 'patient_id' },
  { table: PRACTITIONERS, column: 'display_name', ownedBy: 'practitioner_id' },
];

/**
 * What this context keeps of a person in clear, and how an erasure removes it: the notes the
 * staff wrote about the appointments of a patient and the reasons of their cancellations read
 * `[erased]` afterwards, in the appointments and in the agenda; the documents attached to those
 * appointments are deleted from the file storage and forgotten by the rows; the display name
 * the practitioner directory copied from identity reads `[erased]`. The appointments themselves
 * stay: a booking is a fact of the practice, and it names the person by an opaque id alone. The
 * words sealed in the attendance records are erased by the key of the patient, not here. Tenant
 * data: every statement reaches it through `ownTenantTable`, confined to the network of the work.
 */
@Repository(PatientErasure)
export class KnexPatientErasure implements PatientErasure {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly files: FileStorage,
  ) {}

  /** Erases every copy in the network of the work, and answers how many rows it reached. Running it again reaches none. */
  async erase(personId: string): Promise<number> {
    let reached = await this.forgetDocuments(personId);

    for (const personal of PERSONAL_COLUMNS) {
      reached += await this.pseudonymise(personal, personId);
    }

    return reached;
  }

  /** The content first, then the reference: a row that still names a deleted file is run again, a file nothing names is lost. */
  private async forgetDocuments(patientId: string): Promise<number> {
    const attached = await this.documentsOf(patientId).select('document_key');

    for (const { document_key } of attached) {
      if (document_key !== null) {
        await this.files.delete(document_key);
      }
    }

    return this.documentsOf(patientId).update(NO_DOCUMENT);
  }

  private documentsOf(patientId: string) {
    return ownTenantTable<AppointmentRow>(this.database, this.scope, APPOINTMENTS)
      .where({ patient_id: patientId })
      .whereNotNull('document_key');
  }

  private pseudonymise({ table, column, ownedBy }: PersonalColumn, personId: string): Promise<number> {
    return ownTenantTable<TextRow>(this.database, this.scope, table)
      .where(ownedBy, personId)
      .whereNotNull(column)
      .whereNot(column, ERASED_PERSONAL_DATA)
      .update({ [column]: ERASED_PERSONAL_DATA });
  }
}
