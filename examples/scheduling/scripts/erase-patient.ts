import { PersonalDataCipher } from '@ddd-ts-kit/kernel';
import { layFoundations } from '@/platform/composition/lay-foundations';
import { openPersistence } from '@/platform/database/open-persistence';
import { eraseOnTheCommandLine } from '@/platform/events/erase-on-the-command-line';
import { storeFedProjections } from '@/platform/events/store-fed-projections';

// `npm run erase:patient -- <patientId> <operatorId>`: the right to erasure of a patient.
// Destroys the key the words of the patient were sealed with in the attendance records, writes
// the erasure to the audit trail, with the operator as actor, then rebuilds the projections fed
// by the event store, so the history shows `[erased]` in their place. Run against the database
// of the application (DATABASE_URL), while it runs or not: a rebuild never stops the catch-up.
// Running it again for the same patient completes an erasure whose entry or rebuild failed.
const patientId = process.argv[2] ?? '';
// The operator is required: the audit entry is the proof of the erasure, and it names who ran it.
const operator = process.argv[3] ?? '';
const databaseUrl = process.env['DATABASE_URL'] ?? '';

if (patientId === '' || operator === '' || databaseUrl === '') {
  console.error('Usage: DATABASE_URL=<url> npm run erase:patient -- <patientId> <operatorId>');
  process.exit(2);
}

const persistence = openPersistence({ databaseUrl });

try {
  // The scope, the ids and the audited keys of the application itself, so that the entry is the one a use case would write.
  const { scope, ids, audit } = layFoundations(persistence, {});
  const { subjectKeys } = audit;

  const report = await eraseOnTheCommandLine(
    patientId,
    { keys: subjectKeys, projections: storeFedProjections(persistence, new PersonalDataCipher(subjectKeys)) },
    { scope, ids, operator },
  );

  console.log(JSON.stringify({ patientId, ...report }));
} finally {
  await persistence.close();
}
