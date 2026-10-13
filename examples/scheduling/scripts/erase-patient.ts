import { PersonalDataCipher } from '@ddd-ts-kit/kernel';
import { openPersistence } from '@/platform/database/open-persistence';
import { eraseDataSubject } from '@/platform/events/erase-data-subject';
import { storeFedProjections } from '@/platform/events/store-fed-projections';

// `npm run erase:patient -- <patientId>`: the right to erasure of a patient. Destroys the key the
// words of the patient were sealed with in the attendance records, then rebuilds the projections
// fed by the event store, so the history shows `[erased]` in their place. Run against the
// database of the application (DATABASE_URL), while it runs or not: a rebuild never stops the
// catch-up. Running it again for the same patient completes an erasure whose rebuild failed.
const patientId = process.argv[2] ?? '';
const databaseUrl = process.env['DATABASE_URL'] ?? '';

if (patientId === '' || databaseUrl === '') {
  console.error('Usage: DATABASE_URL=<url> npm run erase:patient -- <patientId>');
  process.exit(2);
}

const persistence = openPersistence({ databaseUrl });

try {
  const { subjectKeys } = persistence.eventSourcing;

  const report = await eraseDataSubject(patientId, {
    keys: subjectKeys,
    projections: storeFedProjections(persistence, new PersonalDataCipher(subjectKeys)),
  });

  console.log(JSON.stringify({ patientId, ...report }));
} finally {
  await persistence.close();
}
