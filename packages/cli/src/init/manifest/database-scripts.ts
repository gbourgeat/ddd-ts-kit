import type { Config } from '../../config/index.js';

/** The pipelines call `db:migrate` before the adapter specs whatever the stack: without a database it says so and succeeds. */
const DATABASE_SCRIPTS: Readonly<Record<string, Record<string, string>>> = {
  none: { 'db:migrate': 'echo "No database to migrate."' },
  custom: { 'db:migrate': 'echo "Custom persistence: run your own migrations here."' },
  // drizzle-kit loads the TypeScript schema, which re-exports the tables of each context by their alias: it reads the `paths` of tsconfig.json itself.
  // Every `db:generate` takes what the migration does (`npm run db:generate add-invoices`) and refuses to run without it: the tool prefixes it with a timestamp.
  // Through the CLI: without a terminal drizzle-kit cannot ask whether a column is renamed, writes nothing and exits 0; `drizzle-generate` fails then, with the fix.
  drizzle: { 'db:generate': 'ddd-ts-kit drizzle-generate --name', 'db:migrate': 'drizzle-kit migrate' },
  knex: { 'db:generate': 'knex migrate:make', 'db:migrate': 'npm run build && knex migrate:latest' },
  // The client and the schema of the tests are build products of prisma/schema.prisma: every entry point refreshes them.
  prisma: {
    'db:client':
      'prisma generate && prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o generated/schema.sql',
    'db:generate': 'prisma migrate dev --create-only --name',
    'db:migrate': 'prisma migrate deploy',
    pretypecheck: 'npm run db:client',
    prebuild: 'npm run db:client',
    pretest: 'npm run db:client',
    'pretest:e2e': 'npm run db:client',
  },
};

/** drizzle-kit generates no trigger: the statements that make the audit entries append-only are printed, to paste in a custom migration. */
const AUDIT_GUARD = `node --input-type=module -e "import { auditGuardStatements } from '@ddd-ts-kit/audit/drizzle'; console.log(auditGuardStatements('audit').join(';\\n') + ';')"`;

export function databaseScripts(config: Config): Record<string, string> {
  const { orm, audit } = config.stack;

  return { ...scriptsOf(config), ...(orm === 'drizzle' && audit === 'on' ? { 'db:audit-guard': AUDIT_GUARD } : {}) };
}

/** The TypeORM CLI reads the compiled data source of the platform, wherever the project keeps its platform; it takes the path of the new migration (`npm run db:generate migrations/add-invoices`). */
function scriptsOf(config: Config): Record<string, string> {
  const { orm } = config.stack;
  const dataSource = `dist/${config.platformDir}/database/data-source.js`;

  if (orm !== 'typeorm') {
    return DATABASE_SCRIPTS[orm] ?? {};
  }

  return {
    'db:generate': `typeorm migration:generate -d ${dataSource}`,
    'db:migrate': `typeorm migration:run -d ${dataSource}`,
  };
}
