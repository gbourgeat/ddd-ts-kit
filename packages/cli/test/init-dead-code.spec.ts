import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';
import { keysAt } from './support/keys-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';

const VALIDATION = '@ddd-ts-kit/validation';
const BILLING = ['--context', 'billing:core'];

const ignored = (root: string): string[] => stringsAt(readJson(root, 'knip.json'), 'ignoreDependencies');

/**
 * What the dead-code gate is told about a project that uses nothing yet. A dependency every
 * generated route needs is installed from the start: where the route of the audit trail does not
 * use it already, knip is told to wait, and the note goes with the first file that validates.
 * The end-to-end suite runs knip itself, on every stack (`first-minute-no-context.spec.ts`).
 */
describe('the validation packages of a project that validates nothing yet', () => {
  it('are reported by nobody where the route of the audit trail uses them: the default stack', () => {
    expect(keysAt(readJson(initProject(), 'knip.json'))).not.toContain('ignoreDependencies');
    expect(ignored(initProject('--ci', 'gitlab'))).toEqual(['eslint-formatter-gitlab']);
  });

  it.each([
    [
      ['--audit', 'off'],
      [VALIDATION, 'zod'],
    ],
    [['--orm', 'none', '--validation', 'standard-schema'], [VALIDATION]],
    [['--http', 'none', '--validation', 'none'], [VALIDATION]],
    [
      ['--orm', 'none', '--validation', 'class-validator'],
      [VALIDATION, 'class-validator', 'class-transformer', 'class-validator-jsonschema'],
    ],
    [
      ['--di', 'manual', '--audit', 'off', '--validation', 'class-validator', '--ci', 'gitlab'],
      [
        'eslint-formatter-gitlab',
        VALIDATION,
        'class-validator',
        'class-transformer',
        'class-validator-jsonschema',
        'reflect-metadata',
      ],
    ],
    [
      ['--http', 'nest', '--orm', 'none', '--validation', 'class-validator', '--routes', 'controllers'],
      [VALIDATION, 'class-validator-jsonschema'],
    ],
  ])('wait in knip.json where nothing uses them, with what the library brings (%j)', (flags, waiting) => {
    expect(ignored(initProject(...flags))).toEqual(waiting);
  });

  it('do not wait under Nest controllers, whose composition reads their DTO classes from the start', () => {
    expect(ignored(initProject('--http', 'nest', '--orm', 'none'))).toEqual([]);
  });

  it('stop waiting with the first file that validates, and knip.json keeps what else it ignores', () => {
    const root = initProject('--audit', 'off', '--ci', 'gitlab', ...BILLING);

    cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');

    expect(ignored(root)).toContain('zod');
    expect(routed(root).code).toBe(0);
    expect(ignored(root)).toEqual(['eslint-formatter-gitlab']);

    expect(
      read(root, 'src/contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.controller.ts'),
    ).toContain(`from '${VALIDATION}/zod'`);
  });

  it('leave no key behind when nothing else was ignored', () => {
    const root = initProject('--orm', 'none', ...BILLING);

    routed(root);

    expect(keysAt(readJson(root, 'knip.json'))).not.toContain('ignoreDependencies');
  });

  it('are left to the trunk by a worker confined to its context: `docs` settles it there', () => {
    const root = initProject('--orm', 'none', ...BILLING);

    expect(routed(root, '--local-only').stderr).toBe('');
    expect(ignored(root)).toEqual([VALIDATION, 'zod']);
    // The page of what the tests of the context state is a shared file too: the trunk writes it.
    expect(cli(root, 'docs', '--check').stdout).toContain('docs/behaviour/billing.md');
    expect(cli(root, 'docs').code).toBe(0);
    expect(cli(root, 'docs', '--check').code).toBe(0);
    expect(ignored(root)).toEqual([]);
  });

  it('are never told to wait again: a list the team emptied or rewrote is theirs', () => {
    const root = initProject('--orm', 'none', ...BILLING);

    write(root, 'knip.json', JSON.stringify({ entry: [], ignoreDependencies: ['zod'] }));
    routed(root);

    expect(ignored(root)).toEqual(['zod']);
  });
});

describe('the database of the tests, in a project nothing drives through HTTP', () => {
  const testEntries = (root: string): string[] => stringsAt(readJson(root, 'knip.json'), 'vitest', 'entry');
  const helper = 'src/platform/database/open-test-database.ts';

  it('is kept ready for the first repository spec, as a fake is: the test runner enters by it', () => {
    expect(testEntries(initProject('--http', 'none'))).toContain(helper);
    expect(testEntries(initProject('--http', 'none', '--orm', 'knex'))).toContain(helper);
  });

  it('is no entry where the end-to-end support opens it, nor where there is no database', () => {
    expect(testEntries(initProject())).not.toContain(helper);
    expect(testEntries(initProject('--http', 'none', '--orm', 'none'))).not.toContain(helper);
  });
});

describe('the files an ORM reads by itself', () => {
  it('are known to knip: the data source the TypeORM CLI loads, the schema the Prisma CLI reads', () => {
    expect(stringsAt(readJson(initProject('--orm', 'typeorm'), 'knip.json'), 'entry')).toContain(
      'src/platform/database/data-source.ts',
    );

    expect(stringsAt(readJson(initProject('--orm', 'prisma'), 'knip.json'), 'project')).toContain('prisma/**/*.prisma');
  });
});

/** An aggregate, its command and the route of that command, in billing: the route is the first file that validates. */
function routed(root: string, ...more: string[]): ReturnType<typeof cli> {
  cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');

  cli(
    root,
    'generate',
    'command',
    'billing',
    'IssueInvoice',
    '--creates',
    '--aggregate',
    'Invoice',
    '--public',
    '--allow-name',
  );

  return cli(root, 'generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices', ...more);
}
