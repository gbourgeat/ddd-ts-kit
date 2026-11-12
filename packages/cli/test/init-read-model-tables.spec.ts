import { rmSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { expectOk } from './support/expect-ok';
import { initProject } from './support/init-project';
import { billingProject, generateReadModel, withInvoiceSummaries } from './support/read-model-project';
import { readJson } from './support/read-json';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
const SCRIPT = 'tsx --env-file-if-exists=.env scripts/read-model-tables.ts';

const LIST = 'database/read-model-tables.ts';

/** The class of the store `generate read-model` writes on each ORM, and its file. */
const STORES = [
  ['drizzle', 'DrizzleInvoiceSummaries', 'drizzle-invoice-summaries'],
  ['knex', 'KnexInvoiceSummaries', 'knex-invoice-summaries'],
  ['prisma', 'PrismaInvoiceSummaries', 'prisma-invoice-summaries'],
  ['typeorm', 'TypeOrmInvoiceSummaries', 'type-orm-invoice-summaries'],
] as const;

describe('init: the read model tables the application lists, checked before a store is used', () => {
  it('writes the list empty, on the four ORM: nothing is read from the database that no store names', () => {
    for (const [orm] of STORES) {
      const tables = platform(initProject('--orm', orm), LIST);

      expect(tables).toContain(
        'const LISTED: readonly ((persistence: Persistence) => ReadModelInATable)[] = [\n' +
          '  // ddd-ts-kit:read-model-tables\n  // /ddd-ts-kit:read-model-tables\n];',
      );

      expect(tables).toContain('  return new ReadModelTables(LISTED.map((build) => () => build(persistence)));');
    }
  });

  it('lists the store of a generated read model, built as the application binds it, on the four ORM', () => {
    for (const [orm, store, file] of STORES) {
      const root = billingProject('--orm', orm);

      withInvoiceSummaries(root);

      const tables = platform(root, LIST);

      expect(tables).toContain(
        `import { ${store} } from '@/contexts/billing/infrastructure/persistence/${file}.repository';`,
      );

      expect(tables).toContain(`  ({ database }) => new ${store}(database),\n  // /ddd-ts-kit:read-model-tables`);
    }
  });

  it('lists a read model of tenant data with a scope of its own, which the check never reads', () => {
    const root = billingProject('--orm', 'knex', '--tenancy', 'shared-table');

    withInvoiceSummaries(root);
    expectOk(generateReadModel(root, 'OpenInvoices'));

    const tables = platform(root, LIST);

    expect(tables.match(/import \{ AsyncLocalStorageExecutionScope \} from '@ddd-ts-kit\/kernel';/g)).toHaveLength(1);

    expect(tables).toContain(
      '  ({ database }) => new KnexInvoiceSummaries(database, new AsyncLocalStorageExecutionScope()),\n' +
        '  ({ database }) => new KnexOpenInvoices(database, new AsyncLocalStorageExecutionScope()),\n',
    );
  });

  it('keeps the list through init --force, and says where to add the store when the project has no list', () => {
    const root = billingProject('--orm', 'knex');

    withInvoiceSummaries(root);
    expectOk(cli(root, 'init', '--force'));

    expect(platform(root, LIST)).toContain('  ({ database }) => new KnexInvoiceSummaries(database),');
    expect(platform(root, LIST)).toContain("knex-invoice-summaries.repository';\n// /ddd-ts-kit:imports");

    rmSync(path.join(root, 'src/platform', LIST));

    expect(generateReadModel(root, 'OpenInvoices').stdout).toContain(
      'src/platform/database/read-model-tables.ts does not exist: wire the new element by hand.',
    );
  });

  it('lists nothing for a read model kept in memory, which has no table', () => {
    const root = billingProject('--orm', 'none');

    withInvoiceSummaries(root);

    expect(exists(root, `src/platform/${LIST}`)).toBe(false);
  });

  it('asks it when the platform module starts, on a container of the kit, and lets the application soften it', () => {
    for (const di of ['tsyringe', 'inversify', 'awilix']) {
      const module = platform(initProject('--di', di), 'composition/platform.module.ts');

      expect(module).toContain(
        '    onStart: ({ resolve }) => readModelTables(persistence).atStart(resolve(Logger), options.readModelTables),',
      );

      expect(module).toContain('  readonly readModelTables?: ReadModelTablesAtStart;');
      expect(module.match(/import \{[^}]*\bLogger\b[^}]*\} from '@ddd-ts-kit\/kernel';/g)).toHaveLength(1);
    }

    const explicit = platform(initProject('--style', 'explicit'), 'composition/platform.module.ts');

    expect(explicit).toContain('readModelTables(persistence).atStart(resolve(Logger), options.readModelTables)');
  });

  it('asks it in the start of a platform wired by hand, before the event provider delivers anything', () => {
    const root = initProject('--di', 'manual', '--orm', 'knex');

    expect(platform(root, 'composition/compose-application.ts')).toContain(
      '  await platform.readModelTables.atStart(platform.logger, options.readModelTables);\n' +
        '  await options.events.start();\n',
    );

    expect(platform(root, 'composition/create-platform.ts')).toContain(
      '    readModelTables: readModelTables(persistence),',
    );

    expect(platform(root, 'composition/platform.ts')).toContain('  readonly readModelTables: ReadModelTables;');

    expect(platform(root, 'composition/platform-options.ts')).toContain(
      '  readonly readModelTables?: ReadModelTablesAtStart;',
    );
  });

  it('writes the script that asks it of the database of a deployment, and says both in the README', () => {
    const root = initProject();

    expect(readJson(root, 'package.json')).toMatchObject({ scripts: { 'db:read-models': SCRIPT } });

    const script = read(root, 'scripts/read-model-tables.ts');

    expect(script).toContain('    const { ready, text } = await readModelTables(persistence).report();');
    expect(script).toContain('  const persistence = openPersistence({ databaseUrl });');
    expect(script).not.toContain('loadConfig');
    expect(script).toContain('const NOT_READY = 1;\nconst NO_DATABASE = 2;\nconst UNREAD = 3;');

    expect(read(initProject('--orm', 'prisma'), 'scripts/read-model-tables.ts')).toContain(
      'await openPersistence({ databaseUrl, databaseTransaction: { waitMs: 2_000, timeoutMs: 5_000 } });',
    );
    expect(read(root, 'README.md')).toContain(' run db:read-models` says the same of that database');
    expect(read(root, 'README.md')).toContain("`readModelTables: 'reported'` to `composeApplication`");
  });

  it('writes none of it without a database: a read model kept in memory has no table', () => {
    for (const flags of [
      ['--orm', 'none'],
      ['--orm', 'none', '--di', 'manual'],
      ['--orm', 'custom'],
    ]) {
      const root = initProject(...flags);

      expect(exists(root, 'src/platform/database/read-model-tables.ts')).toBe(false);
      expect(exists(root, 'scripts/read-model-tables.ts')).toBe(false);
      expect(read(root, 'package.json')).not.toContain('db:read-models');
      expect(read(root, 'README.md')).not.toContain('db:read-models');
      expect(platform(root, 'composition/compose-application.ts')).not.toContain('readModelTables');
      expect(platform(root, 'composition/compose-application.ts')).not.toContain('read model tables');
    }

    expect(platform(initProject('--orm', 'none'), 'composition/platform.module.ts')).not.toContain('readModelTables');

    expect(platform(initProject('--orm', 'none', '--di', 'manual'), 'composition/platform-options.ts')).not.toContain(
      'readModelTables',
    );
  });
});
