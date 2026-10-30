import { describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read, scaffoldEverything, tempDir, write, type StackFlags } from './helpers';
import { commitAll } from './support/commit-all';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { ok, orderingProject } from './support/ordering-project';

const FULL = ['--audit', 'on', '--privacy', 'on'];

/** What `scaffoldEverything` leaves out and that writes outside the context: a repository of personal data, a role of a group of routes, a development dependency. */
function wireTheRest(root: string, withHttp: boolean): void {
  const generate = (...args: string[]): void => {
    ok(cli(root, 'generate', ...args));
  };

  generate('context', 'people', '--classification', 'supporting', '--term', 'Customer=Someone who buys');
  generate('aggregate', 'people', 'Customer');
  generate('repository', 'people', 'Customer', '--personal', 'email,full_name');
  generate('vo', 'people', 'Email', '--term', 'Email=Where a customer is reached');
  generate('property', 'people', 'Email');

  if (withHttp) {
    generate('route-group', 'people', 'Backoffice', '--prefix', '/backoffice', '--role', 'support');
  }
}

/** One project of a stack, every kind generated, committed, then `init --force` at the same version: what git sees changed. */
function diffAfterForce(stack: StackFlags, more: readonly string[]): string {
  const root = tempDir('force-keeps');

  scaffoldEverything(root, stack, more);
  wireTheRest(root, stack.http !== 'none');
  commitAll(root);

  const forced = ok(cli(root, 'init', '--force'));

  expect(forced.stderr).toBe('');

  return git(root, 'diff');
}

describe('init --force at the same version leaves no diff', () => {
  it.each(['knex', 'drizzle', 'prisma', 'typeorm'])('with every kind generated, on %s', (orm) => {
    expect(diffAfterForce({ ...DEFAULT_STACK, orm }, FULL)).toBe('');
  });

  it.each<[string, StackFlags, readonly string[]]>([
    ['the explicit style', { ...DEFAULT_STACK, style: 'explicit' }, FULL],
    ['discovery', { ...DEFAULT_STACK, assembly: 'discovery' }, FULL],
    ['a manual container', { ...DEFAULT_STACK, di: 'manual' }, FULL],
    ['Nest', { ...DEFAULT_STACK, http: 'nest', di: 'nest' }, FULL],
    ['attribute policies', DEFAULT_STACK, [...FULL, '--authz', 'abac']],
    ['relationships', DEFAULT_STACK, [...FULL, '--authz', 'rebac']],
    ['no HTTP', { ...DEFAULT_STACK, http: 'none' }, FULL],
    ['an event store', { ...DEFAULT_STACK, orm: 'knex' }, [...FULL, '--event-sourcing', 'on']],
    ['tenants', { ...DEFAULT_STACK, orm: 'knex' }, [...FULL, '--tenancy', 'shared-table']],
    ['clients, on pnpm', DEFAULT_STACK, [...FULL, '--sdk', '--package-manager', 'pnpm']],
  ])('on %s', (_name, stack, more) => {
    expect(diffAfterForce(stack, more)).toBe('');
  });

  it.each(['knex', 'drizzle', 'prisma'])('with the identity preset and its tenants, on %s', (orm) => {
    const root = initProject(
      '--orm',
      orm,
      '--authn',
      'keycloak',
      '--tenancy',
      'shared-table',
      '--privacy',
      'on',
      '--preset',
      'identity',
    );

    commitAll(root);
    ok(cli(root, 'init', '--force'));

    expect(git(root, 'diff')).toBe('');
  });
});

const SCHEMA_INDEX = 'src/platform/database/schema.ts';
const AUDITED = 'src/platform/audit/audited-events.ts';
const ROLES = 'src/platform/auth/roles/roles.ts';
const PLATFORM_MODULE = 'src/platform/composition/platform.module.ts';
const JOB_SETTINGS = 'src/platform/jobs/job-settings.ts';
const COMPOSE = 'docker-compose.yml';

/** The file with the body of a region taken out, as `--force` of 0.101 left it. */
function emptied(text: string, region: string): string {
  return text.replace(
    new RegExp(`(// ddd-ts-kit:${region}\\n)[\\s\\S]*?([ \\t]*// /ddd-ts-kit:${region}\\n)`),
    (_found, open: string, close: string) => `${open}${close}`,
  );
}

describe('init --force on what an earlier version left', () => {
  it.each(['knex', 'drizzle', 'typeorm'])(
    'lists again from the tree the tables and the events it lost, on %s',
    (orm) => {
      const root = orderingProject(orm);

      const lost = (file: string): void => {
        write(root, file, emptied(emptied(read(root, file), 'imports'), file === AUDITED ? 'events' : 'schemas'));
      };

      lost(SCHEMA_INDEX);
      lost(AUDITED);
      commitAll(root);
      ok(cli(root, 'init', '--force'));

      expect(git(root, 'diff', 'HEAD~1', '--', SCHEMA_INDEX, AUDITED)).toBe('');
    },
  );

  it('writes again the service of a context run alone that the compose file lost', () => {
    const root = orderingProject('knex');

    ok(cli(root, 'generate', 'service', 'ordering'));

    const whole = read(root, COMPOSE);

    write(root, COMPOSE, whole.replace(/\n {2}# The context "ordering"[\s\S]*?3000"\n/, ''));
    commitAll(root);
    ok(cli(root, 'init', '--force'));

    expect(read(root, COMPOSE)).toBe(whole);
  });

  it('lists again the schema of the context in the datasource of Prisma', () => {
    const root = orderingProject('prisma');
    const main = 'prisma/schema/schema.prisma';

    write(root, main, read(root, main).replace(', "ordering"', ''));
    commitAll(root);
    ok(cli(root, 'init', '--force'));

    expect(read(root, main)).toContain('"ordering"]');
  });

  it('keeps the regions where the template now puts them, and takes what the template now says around them', () => {
    const root = orderingProject('knex');
    const before = read(root, SCHEMA_INDEX);

    write(
      root,
      SCHEMA_INDEX,
      `// written by an earlier version\n${before.replace('export async function', 'async function earlier')}`,
    );

    commitAll(root);
    ok(cli(root, 'init', '--force'));

    expect(read(root, SCHEMA_INDEX)).toBe(before);
  });

  it('names, file by file with its command, a region this version no longer holds and the tree does not give back', () => {
    const root = orderingProject('knex');

    const renamed = read(root, AUDITED)
      .replace('// ddd-ts-kit:imports', '// ddd-ts-kit:audit-imports')
      .replace('// /ddd-ts-kit:imports', '// /ddd-ts-kit:audit-imports');

    write(
      root,
      ROLES,
      read(root, ROLES)
        .replace('// ddd-ts-kit:system-grants', '// ddd-ts-kit:grants')
        .replace('// /ddd-ts-kit:system-grants', '// /ddd-ts-kit:grants'),
    );

    write(root, AUDITED, renamed);

    const job = read(root, JOB_SETTINGS)
      .replace('// ddd-ts-kit:jobs\n', "// ddd-ts-kit:scheduled\n    'ordering.close': { enabled: false },\n")
      .replace('// /ddd-ts-kit:jobs', '// /ddd-ts-kit:scheduled');

    write(root, JOB_SETTINGS, job);
    commitAll(root);

    const forced = ok(cli(root, 'init', '--force'));

    expect(read(root, AUDITED)).toContain('orderPlacedV1,');
    expect(forced.stdout).not.toContain(`${AUDITED}: --force could not keep`);
    expect(forced.stdout).toContain(`${JOB_SETTINGS}: --force could not keep 1 line(s) of "scheduled"`);
    expect(forced.stdout).toContain('`git show HEAD:src/platform/jobs/job-settings.ts`');
    expect(read(root, JOB_SETTINGS)).not.toContain('ordering.close');
  });

  it('names a roles file it cannot read, whose grants the tree does not say', () => {
    const root = orderingProject('knex');

    write(root, ROLES, 'export const roles = buildRoles();\n');
    commitAll(root);

    const forced = ok(cli(root, 'init', '--force'));

    expect(forced.stdout).toContain(`${ROLES}: it holds no object of roles the kit reads to its end`);
    expect(forced.stdout).toContain('--grant <role>` writes them again');
  });
});

describe('init --force that changes the stack', () => {
  it('leaves out the lines written for the ORM it leaves, and keeps the others', () => {
    const root = orderingProject('drizzle');

    commitAll(root);
    ok(cli(root, 'init', '--force', '--orm', 'knex'));

    expect(read(root, SCHEMA_INDEX)).not.toContain('ordering.schema');
    expect(read(root, ROLES)).toContain("orderingPermissions['order.place']");
  });

  it('wires the contexts for the container it moves to, without the lines of the one it leaves', () => {
    const root = orderingProject('knex', '--style', 'explicit');
    const composition = 'src/platform/composition/compose-application.ts';

    expect(read(root, composition)).toContain('orderingRoutes');

    ok(cli(root, 'init', '--force', '--di', 'manual'));

    expect(read(root, composition)).not.toContain('orderingRoutes');
    expect(read(root, composition)).toContain('orderingModule,');
  });

  it('keeps every line when the config cannot be read', () => {
    const root = orderingProject('knex');
    const config = 'ddd-ts-kit.config.json';

    write(root, config, `${read(root, config)}not json`);
    commitAll(root);
    ok(cli(root, 'init', '--force'));

    expect(read(root, AUDITED)).toContain('orderPlacedV1,');
  });
});

describe('init --force keeps what the team wrote where the generators write', () => {
  it('the value of a gateway, the settings of a job, a service of its own', () => {
    const root = tempDir('force-keeps');

    scaffoldEverything(root, DEFAULT_STACK, FULL);

    const value = 'builder.bind(InvoiceStatusContract).toValue({ read: () => undefined });';
    const module = read(root, PLATFORM_MODULE).replace('builder.bind(InvoiceStatusContract).toValue({});', value);
    const settings = "'billing.cancel-stale-invoices': { enabled: environment['STALE'] === 'yes', timeoutMs: 5000 },";

    write(root, PLATFORM_MODULE, module);

    write(root, JOB_SETTINGS, read(root, JOB_SETTINGS).replace(/'billing\.cancel-stale-invoices': \{[^\n]*/, settings));

    const mailer = '\n  # What the team reads its mail with.\n  mailhog:\n    image: mailhog/mailhog\n';

    write(root, COMPOSE, read(root, COMPOSE).replace('\n  # The scheduled jobs', `${mailer}\n  # The scheduled jobs`));
    commitAll(root);
    ok(cli(root, 'init', '--force'));

    expect(git(root, 'diff')).toBe('');
    expect(read(root, PLATFORM_MODULE)).toContain(value);
  });

  it('the journal of the migrations, which an empty one would make generate every table again', () => {
    const root = orderingProject('drizzle');
    const journal = 'migrations/meta/_journal.json';

    const entries = JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [{ idx: 0, tag: '20260101_init' }],
    });

    write(root, journal, entries);
    commitAll(root);

    const forced = ok(cli(root, 'init', '--force'));

    expect(read(root, journal)).toBe(entries);
    expect(forced.stdout).toContain(`kept         ${journal}`);
  });

  it('says that nothing wired is lost, and not what it used to list as lost', () => {
    const forced = ok(cli(orderingProject('knex'), 'init', '--force'));

    expect(forced.stdout).toContain('kept what the generators and the team wrote in their regions');
    expect(forced.stdout).toContain('Nothing the generators wired is lost');
    expect(forced.stdout).not.toContain('is gone');
    expect(forced.stdout).not.toContain('could not keep');
  });
});
