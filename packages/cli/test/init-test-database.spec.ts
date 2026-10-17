import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers.js';
import { initProject } from './support/init-project.js';

const TEMPLATE = 'test/support/test-database-template.ts';
const GLOBAL_SETUP = `globalSetup: ['${TEMPLATE}'],`;
const OPEN = 'src/platform/database/open-test-database.ts';
const SUPPORT = 'test/e2e/support/start-application.ts';

describe('the test database of a project on an ORM', () => {
  it.each(['drizzle', 'knex', 'prisma', 'typeorm'])(
    'with %s, starts from a cluster a global setup initialised once per Vitest run, and creates its tables in each spec',
    (orm) => {
      const root = initProject('--orm', orm);

      expect(read(root, TEMPLATE)).toContain("process.env['TEST_DATABASE_TEMPLATE'] = file;");
      expect(read(root, 'vitest.config.ts')).toContain(GLOBAL_SETUP);
      expect(read(root, 'vitest.e2e.config.ts')).toContain(GLOBAL_SETUP);

      expect(read(root, OPEN)).toContain(
        'return PGlite.create(template === undefined ? {} : { loadDataDir: await openAsBlob(template) });',
      );

      expect(read(root, OPEN)).toContain('= await startedPostgres();');
    },
  );

  it('with Jest, is initialised by each spec, as no global setup names a cluster', () => {
    const root = initProject('--tests', 'jest');

    expect(exists(root, TEMPLATE)).toBe(false);
    expect(read(root, OPEN)).not.toContain('TEST_DATABASE_TEMPLATE');
  });

  it('without an ORM, does not exist: no global setup is named', () => {
    const root = initProject('--orm', 'none');

    expect(exists(root, TEMPLATE)).toBe(false);
    expect(read(root, 'vitest.config.ts')).not.toContain('globalSetup');
    expect(read(root, 'vitest.e2e.config.ts')).not.toContain('globalSetup');
  });
});

describe('the end-to-end support', () => {
  it('settles once the outbox of the database is relayed', () => {
    expect(read(initProject(), SUPPORT)).toContain(
      'settled: (options) => settled({ outbox: () => database.persistence.outbox.stats() }, options),',
    );
  });

  it('settles on the outbox of the memory without an ORM, and at once without an outbox', () => {
    expect(read(initProject('--orm', 'none', '--events', 'outbox'), SUPPORT)).toContain(
      'settled: (options) => settled({ outbox: () => persistence.outbox.stats() }, options),',
    );

    expect(read(initProject('--orm', 'none'), SUPPORT)).toContain('settled: (options) => settled({}, options),');
  });
});
