import { PersonalDataCipher } from '@ddd-ts-kit/kernel';
import { layFoundations } from '@/platform/composition/lay-foundations';
import { Environment } from '@/platform/config/environment';
import { readFiles } from '@/platform/config/read-files';
import { readNetworks } from '@/platform/config/read-networks';
import { openPersistence } from '@/platform/database/open-persistence';
import { copiesOfAPerson } from '@/platform/erasure/copies-of-a-person';
import { eraseOnTheCommandLine } from '@/platform/erasure/erase-on-the-command-line';
import { NotASubjectIdError } from '@/platform/erasure/not-a-subject-id-error';
import { openFiles } from '@/platform/files/open-files';
import { storeFedProjections } from '@/platform/event-store/store-fed-projections';
import { UnknownDataSubjectError } from '@/platform/erasure/unknown-data-subject-error';
import { KnexPersonDirectory } from '@/contexts/identity/infrastructure/persistence/knex-person-directory.reader';

// `npm run erase:patient -- <patientId> <operatorId>`: the right to erasure of a person.
// Destroys the key the words of the patient were sealed with in the attendance records, writes
// the erasure to the audit trail, with the operator as actor, erases every copy the contexts keep
// of the person in clear in each network (`NETWORKS`): the person of identity, the contact of
// notification, the notes, the cancellation reasons and the documents of their appointments and
// the name of the practitioner directory in scheduling; then rebuilds the projections fed by the
// event store, so the history shows `[erased]` in their place. Run against the database of the
// application (DATABASE_URL) and its file storage (FILES_*), while it runs or not: a rebuild
// never stops the catch-up. Running it again for the same person completes an erasure whose
// entry, copy or rebuild failed. Exit code 2: a usage error, a value that is not an opaque
// identifier (a name, an email), or an id that destroyed no key, erased no copy and that no
// network knows, a mistyped one or an erasure already complete, with nothing rebuilt.
const patientId = process.argv[2] ?? '';
// The operator is required: the audit entry is the proof of the erasure, and it names who ran it.
const operator = process.argv[3] ?? '';
const databaseUrl = process.env['DATABASE_URL'] ?? '';

if (patientId === '' || operator === '' || databaseUrl === '') {
  console.error('Usage: DATABASE_URL=<url> NETWORKS=<tenant,...> npm run erase:patient -- <patientId> <operatorId>');
  process.exit(2);
}

// The networks and the file storage, read as the application reads them: a problem names the variable and stops here.
const env = new Environment(process.env);
const networks = readNetworks(env);
const files = openFiles(readFiles(env, process.env['NODE_ENV'] ?? 'development'));

env.assertValid();

const persistence = openPersistence({ databaseUrl });

try {
  // The scope, the ids and the audited keys of the application itself: the entry is the one a
  // use case would write.
  const { scope, clock, ids, audit } = layFoundations(persistence, {});
  const { subjectKeys } = audit;

  const report = await eraseOnTheCommandLine(
    patientId,
    {
      keys: subjectKeys,
      projections: storeFedProjections(persistence, new PersonalDataCipher(subjectKeys)),
      copies: copiesOfAPerson(persistence, { scope, clock, files }),
    },
    {
      scope,
      ids,
      operator,
      persons: new KnexPersonDirectory(persistence.database, scope),
      elevate: audit.elevate,
      networks,
    },
  );

  console.log(JSON.stringify({ patientId, ...report }));
} catch (error) {
  if (!(error instanceof UnknownDataSubjectError || error instanceof NotASubjectIdError)) {
    throw error;
  }

  console.error(error.message);
  process.exitCode = 2;
} finally {
  await persistence.close();
}
