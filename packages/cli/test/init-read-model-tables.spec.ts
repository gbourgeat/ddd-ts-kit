import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';
import { readJson } from './support/read-json';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
const SCRIPT = 'tsx --env-file-if-exists=.env scripts/read-model-tables.ts';

/** The function of each ORM package, and the entry it is imported from. */
const CHECKS = [
  ['drizzle', 'drizzleReadModelTables', '@ddd-ts-kit/drizzle/postgres'],
  ['knex', 'knexReadModelTables', '@ddd-ts-kit/knex'],
  ['prisma', 'prismaReadModelTables', '@ddd-ts-kit/prisma'],
  ['typeorm', 'typeOrmReadModelTables', '@ddd-ts-kit/typeorm'],
] as const;

describe('init: the read model tables of the database, checked before a store is used', () => {
  it('writes the check of the ORM of the project, on its four ORM', () => {
    for (const [orm, check, from] of CHECKS) {
      const tables = platform(initProject('--orm', orm), 'database/read-model-tables.ts');

      expect(tables).toContain(`import { ${check} } from '${from}';`);

      expect(tables).toContain(
        `export function readModelTables(persistence: Persistence): PostgresReadModelTables {\n  return ${check}(persistence.database);\n}`,
      );
    }
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

    expect(platform(root, 'composition/platform.ts')).toContain('  readonly readModelTables: PostgresReadModelTables;');

    expect(platform(root, 'composition/platform-options.ts')).toContain(
      '  readonly readModelTables?: ReadModelTablesAtStart;',
    );
  });

  it('writes the script that asks it of the database of a deployment, and says both in the README', () => {
    const root = initProject();

    expect(readJson(root, 'package.json')).toMatchObject({ scripts: { 'db:read-models': SCRIPT } });

    expect(read(root, 'scripts/read-model-tables.ts')).toContain(
      'const unready = await readModelTables(persistence).notReady();',
    );

    expect(read(root, 'scripts/read-model-tables.ts')).toContain('process.exitCode = unready.length === 0 ? 0 : 1;');
    expect(read(root, 'README.md')).toContain(' run db:read-models` says the same of that database and exits 1.');
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
