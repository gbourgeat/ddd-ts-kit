import { AsyncLocalStorageExecutionScope, PersonalDataCipher, SystemClock, UuidGenerator } from '@ddd-ts-kit/kernel';
import { createAudit } from '@/platform/audit/create-audit';
import { openPersistence } from '@/platform/database/open-persistence';
import { eraseOnTheCommandLine } from '@/platform/events/erase-on-the-command-line';
import { storeFedProjections } from '@/platform/events/store-fed-projections';

// `npm run erase:patient -- <patientId> [<operatorId>]`: the right to erasure of a patient.
// Destroys the key the words of the patient were sealed with in the attendance records, writes
// the erasure to the audit trail, with the operator as actor, then rebuilds the projections fed
// by the event store, so the history shows `[erased]` in their place. Run against the database
// of the application (DATABASE_URL), while it runs or not: a rebuild never stops the catch-up.
// Running it again for the same patient completes an erasure whose entry or rebuild failed.
const patientId = process.argv[2] ?? '';
const operator = process.argv[3];
const databaseUrl = process.env['DATABASE_URL'] ?? '';

if (patientId === '' || databaseUrl === '') {
  console.error('Usage: DATABASE_URL=<url> npm run erase:patient -- <patientId> [<operatorId>]');
  process.exit(2);
}

const persistence = openPersistence({ databaseUrl });

try {
  const source = { scope: new AsyncLocalStorageExecutionScope(), clock: new SystemClock(), ids: new UuidGenerator() };
  const { subjectKeys } = createAudit(persistence, source);

  const report = await eraseOnTheCommandLine(
    patientId,
    { keys: subjectKeys, projections: storeFedProjections(persistence, new PersonalDataCipher(subjectKeys)) },
    { source, ...(operator === undefined ? {} : { operator }) },
  );

  console.log(JSON.stringify({ patientId, ...report }));
} finally {
  await persistence.close();
}
