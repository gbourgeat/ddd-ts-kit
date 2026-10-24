import { NotADataSubjectIdError, UnknownDataSubjectError } from '@ddd-ts-kit/kernel';
import { layFoundations } from '@/platform/composition/lay-foundations';
import { Environment } from '@/platform/config/environment';
import { readNetworks } from '@/platform/config/read-networks';
import { openPersistence } from '@/platform/database/open-persistence';
import { exportOnTheCommandLine } from '@/platform/privacy/export-on-the-command-line';
import { exportsOfAPerson } from '@/platform/privacy/exports-of-a-person';
import { KnexPersonDirectory } from '@/contexts/identity/infrastructure/persistence/knex-person-directory.reader';

// `npm run privacy:export -- <patientId> <operatorId>`: the right of access and to portability of
// a person. Reads what every context keeps of the person in each network (`NETWORKS`), as the
// `personalFields` declarations say, and prints one dated document
// (`ddd-ts-kit/personal-data-export@1`); every handover is written to the audit trail with the
// operator as actor and the number of records read, never the values. A document is handed by its
// key, not its content. Exit code 2: a usage error, a value that is not an opaque identifier (a
// name, an email), or an id that no context answers and that no network knows.
const patientId = process.argv[2] ?? '';
// The operator is required: the audit entry is the proof of the handover, and it names who ran it.
const operator = process.argv[3] ?? '';
const databaseUrl = process.env['DATABASE_URL'] ?? '';

if (patientId === '' || operator === '' || databaseUrl === '') {
  console.error('Usage: DATABASE_URL=<url> NETWORKS=<tenant,...> npm run privacy:export -- <patientId> <operatorId>');
  process.exit(2);
}

const env = new Environment(process.env);
const networks = readNetworks(env);

env.assertValid();

const persistence = openPersistence({ databaseUrl });

try {
  const { scope, clock, ids, audit } = layFoundations(persistence, {});

  const document = await exportOnTheCommandLine(patientId, exportsOfAPerson(persistence, scope), {
    scope,
    clock,
    ids,
    operator,
    persons: new KnexPersonDirectory(persistence.database, scope),
    audit,
    networks,
  });

  console.log(JSON.stringify(document, null, 2));
} catch (error) {
  if (!(error instanceof UnknownDataSubjectError || error instanceof NotADataSubjectIdError)) {
    throw error;
  }

  console.error(error.message);
  process.exitCode = 2;
} finally {
  await persistence.close();
}
