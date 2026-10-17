import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';
import { WITH_DATABASE } from '../../stack/with-database.js';
import { platformFile } from './platform-file.js';
import { when } from './when.js';

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
    ['migrations/00000000000000_initial.js', 'init/platform/database/migration.knex.js.tpl'],
  ],
  prisma: [
    ['prisma/schema.prisma', 'init/platform/database/schema.prisma.tpl'],
    ['prisma.config.ts', 'init/platform/database/prisma.config.ts.tpl'],
  ],
};

export function persistenceFiles(config: Config): InitFile[] {
  const { orm, tests } = config.stack;
  const files = (PERSISTENCE[orm] ?? []).filter(([file]) => file !== INERT || composesWithoutConnecting(config));

  return [
    ...files.map(([file, variant]) => platformFile(config, `database/${file}`, variant)),
    ...(TOOLING[orm] ?? []),
    // The global setup of Vitest that saves the test database once per run, for each spec to open a copy of it.
    ...when(tests === 'vitest' && WITH_DATABASE.includes(orm), [
      ['test/support/test-database-template.ts', 'init/platform/database/test-database-template.ts.tpl'],
    ]),
  ];
}

/** The script that lists the routes and the hand-wired architecture test compose the application without a database to reach. */
function composesWithoutConnecting(config: Config): boolean {
  return config.stack.http !== 'none' || config.stack.di !== 'tsyringe';
}
