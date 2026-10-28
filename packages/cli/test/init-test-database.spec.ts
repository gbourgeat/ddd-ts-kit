import { describe, expect, it } from 'vitest';
import { exists, read } from './helpers';
import { initProject } from './support/init-project';

const TEMPLATE = 'test/support/test-database-template.ts';
const TEARDOWN = 'test/support/test-database-teardown.ts';
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

      expect(read(root, OPEN)).toContain('= await inProcessPostgres();');
    },
  );

  it.each(['drizzle', 'knex', 'prisma', 'typeorm'])(
    'with %s and ReBAC, writes the grants of the system actors again once reset has emptied the relation tuples',
    (orm) => {
      const root = initProject('--orm', orm, '--authz', 'rebac');
      const support = read(root, SUPPORT);

      expect(support).toContain("import { relateSystemActors } from '");

      expect(support).toMatch(
        /reset: async \(\) => \{\n\s+await database\.reset\(\);\n\s+await relateSystemActors\(\);\n\s+\},/,
      );
    },
  );

  it('without ReBAC, a reset only empties the database', () => {
    const support = read(initProject('--orm', 'prisma'), SUPPORT);

    expect(support).toContain('reset: () => database.reset(),');

    expect(support).not.toContain('relateSystemActors');
  });

  it('with Jest, starts from the same cluster, saved by a global setup and deleted by a global teardown', () => {
    const root = initProject('--tests', 'jest');

    expect(read(root, TEMPLATE)).toContain('export default async function setup(): Promise<void> {');
    expect(read(root, TEMPLATE)).toContain("process.env['TEST_DATABASE_TEMPLATE'] = file;");
    expect(read(root, TEARDOWN)).toContain('await rm(path.dirname(file), { recursive: true, force: true });');
    expect(read(root, 'jest.config.js')).toContain(`globalSetup: '<rootDir>/${TEMPLATE}',`);
    expect(read(root, 'jest.config.js')).toContain(`globalTeardown: '<rootDir>/${TEARDOWN}',`);
    expect(read(root, OPEN)).toContain('= await inProcessPostgres();');
  });

  it('with Vitest, needs no teardown file: the setup resolves its own', () => {
    const root = initProject();

    expect(read(root, TEMPLATE)).toContain('return () => rm(directory, { recursive: true, force: true });');
    expect(exists(root, TEARDOWN)).toBe(false);
  });

  it('without an ORM, does not exist: no global setup is named', () => {
    const root = initProject('--orm', 'none');

    expect(exists(root, TEMPLATE)).toBe(false);
    expect(read(root, 'vitest.config.ts')).not.toContain('globalSetup');
    expect(read(root, 'vitest.e2e.config.ts')).not.toContain('globalSetup');
  });

  it('with Jest and without an ORM, does not exist: no global setup nor teardown is named', () => {
    const root = initProject('--tests', 'jest', '--orm', 'none');

    expect(exists(root, TEMPLATE)).toBe(false);
    expect(exists(root, TEARDOWN)).toBe(false);
    expect(read(root, 'jest.config.js')).not.toContain('globalSetup');
    expect(read(root, 'jest.config.js')).not.toContain('globalTeardown');
  });
});

describe('the memory of a long end-to-end run with Jest', () => {
  it('replaces a worker that grew, out of band, and keeps one worker in band on a shared server', () => {
    const config = read(initProject('--tests', 'jest', '--orm', 'prisma'), 'jest.e2e.config.js');

    expect(config).toContain("workerIdleMemoryLimit: '800MB',");
    expect(config).toContain('maxWorkers: sharedServer ? 1 : 2,');
    expect(config).toContain("const sharedServer = (process.env.DATABASE_URL ?? '') !== '';");
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
