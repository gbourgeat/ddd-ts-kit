import { onKitContainer } from '../../config';
import type { Config } from '../../config';
import type { InitFile } from './init-file';
import { WITH_DATABASE } from '../../stack/with-database';
import { platformFile } from './platform-file';
import { when } from './when';
import { PRISMA_MAIN_SCHEMA } from '../../prisma-schema';

type Variants = readonly (readonly [file: string, variant?: string])[];

const INERT = 'inert-persistence.ts';

const IN_MEMORY: Variants = [
  ['persistence.ts', 'memory'],
  ['open-persistence.ts', 'memory'],
  [INERT, 'memory'],
];

/** Storage adapters of the platform, by ORM: each gives the same `Persistence` to the composition root. */
const PERSISTENCE: Readonly<Record<string, Variants>> = {
  none: IN_MEMORY,
  custom: [...IN_MEMORY, ['open-persistence.contract.spec.ts']],
  drizzle: [
    ...onDatabase('drizzle', 'pooled'),
    ['database.ts', 'drizzle'],
    ['connect-to-database.ts', 'drizzle'],
    ['schema.ts', 'drizzle'],
    // The SQL the in-process database of the tests runs, from the Drizzle definitions: drizzle-kit writes migrations, not tables.
    ['table-statements.ts', 'drizzle'],
  ],
  knex: [...onDatabase('knex', 'pooled'), ['connect-to-database.ts', 'knex'], ['schema.ts', 'knex']],
  prisma: [...onDatabase('prisma', 'prisma'), ['database.ts', 'prisma'], ['create-client.ts', 'prisma']],
  typeorm: [
    ...onDatabase('typeorm', 'typeorm'),
    ['create-data-source.ts', 'typeorm'],
    ['schema.ts', 'typeorm'],
    ['data-source.ts', 'typeorm'],
  ],
};

/** What every ORM has: the handle, how it is opened for the application, for the tools and for the tests. */
function onDatabase(orm: string, opening: string): Variants {
  return [
    ['persistence.ts', 'orm'],
    ['open-persistence.ts', opening],
    [INERT, opening],
    ['persistence-over.ts', orm],
    ['open-test-database.ts', orm],
    // The stores of the kit as the platform wires them, held to their contracts with the capabilities of the stack.
    ['persistence.contract.spec.ts'],
  ];
}

const TOOLING: Readonly<Record<string, InitFile[]>> = {
  drizzle: [
    ['drizzle.config.ts', 'init/platform/database/drizzle.config.ts.tpl'],
    // The journal of drizzle-kit, with no migration yet: `db:migrate` applies nothing instead of failing on a project that has generated none, and `db:generate` writes the first one from it.
    ['migrations/meta/_journal.json', 'init/platform/database/journal.drizzle.json'],
  ],
  knex: [
    ['knexfile.js', 'init/platform/database/knexfile.js.tpl'],
    // The folder, with no migration yet: `db:migrate` applies nothing instead of failing on a project that has generated none.
    ['migrations/.gitkeep', 'init/platform/database/gitkeep'],
  ],
  prisma: [
    [PRISMA_MAIN_SCHEMA, 'init/platform/database/schema.prisma.tpl'],
    ['prisma.config.ts', 'init/platform/database/prisma.config.ts.tpl'],
  ],
};

export function persistenceFiles(config: Config): InitFile[] {
  const { orm, tests } = config.stack;
  const files = (PERSISTENCE[orm] ?? []).filter(([file]) => file !== INERT || composesWithoutConnecting(config));

  return [
    ...files.map(([file, variant]) => platformFile(config, `database/${file}`, variant)),
    ...(TOOLING[orm] ?? []),
    // The global setup that saves the test database once per run, for each spec to open a copy of it; Jest names its teardown apart.
    ...when(WITH_DATABASE.includes(orm), [
      ['test/support/test-database-template.ts', 'init/platform/database/test-database-template.ts.tpl'],
    ]),
    ...when(tests === 'jest' && WITH_DATABASE.includes(orm), [
      ['test/support/test-database-teardown.ts', 'init/platform/database/test-database-teardown.ts.tpl'],
    ]),
  ];
}

/** The script that lists the routes and the hand-wired architecture test compose the application without a database to reach. */
function composesWithoutConnecting(config: Config): boolean {
  return config.stack.http !== 'none' || !onKitContainer(config);
}
