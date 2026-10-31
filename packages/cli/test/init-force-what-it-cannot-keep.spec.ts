import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { commitAll } from './support/commit-all';
import { ok, orderingProject } from './support/ordering-project';

const AUDITED = 'src/platform/audit/audited-events.ts';
const ROLES = 'src/platform/auth/roles/roles.ts';
const SCHEMA_INDEX = 'src/platform/database/schema.ts';
const JOB_SETTINGS = 'src/platform/jobs/job-settings.ts';
const NOTHING_LOST = 'Nothing the generators wired is lost';

const force = (root: string): string => {
  commitAll(root);

  return ok(cli(root, 'init', '--force')).stdout;
};

const withoutMarkers = (text: string, region: string): string =>
  text
    .split('\n')
    .filter((line) => line.trim() !== `// ddd-ts-kit:${region}` && line.trim() !== `// /ddd-ts-kit:${region}`)
    .join('\n');

describe('init --force on a roles file it has to read', () => {
  it('reads the object whatever a comment or a string of it says of a bracket', () => {
    const root = orderingProject('knex');

    const edited = read(root, ROLES)
      .replace("[Role.Admin]: ['*',", "[Role.Admin]: [ // keep } brace\n    '*',")
      .replace('export const roles', "const brace = '}';\nexport const roles");

    write(root, ROLES, edited);
    force(root);

    expect(read(root, ROLES)).toContain('// keep } brace');
    expect(read(root, ROLES)).toContain("orderingPermissions['order.place']");
    expect(read(root, ROLES).trimEnd().endsWith('};')).toBe(true);
  });

  it('leaves out an object it cannot close, and names it', () => {
    const root = orderingProject('knex');

    write(root, ROLES, read(root, ROLES).replace(/\};\n$/, ''));

    const said = force(root);

    expect(read(root, ROLES).trimEnd().endsWith('};')).toBe(true);
    expect(said).toContain(`${ROLES}: `);
    expect(said).toContain('--grant <role>');
    expect(said).not.toContain(NOTHING_LOST);
  });

  it('writes back the region of the system grants that an older template did not have', () => {
    const root = orderingProject('knex');

    write(root, ROLES, withoutMarkers(read(root, ROLES), 'system-grants'));
    force(root);

    expect(read(root, ROLES)).toContain('// ddd-ts-kit:system-grants');
    expect(read(root, ROLES)).toContain('// /ddd-ts-kit:system-grants');
  });

  it('names a roles file that has no list of system actors to hold that region', () => {
    const root = orderingProject('knex');

    write(root, ROLES, read(root, ROLES).replace(/\s*\[Role\.System\]: \[[\s\S]*?\n {2}\],/, ''));

    const said = force(root);

    expect(said).toContain(`${ROLES}: `);
    expect(said).toContain('system-grants');
  });
});

describe('init --force on a marker removed by hand', () => {
  it('does not take an import for the wiring: the event and the tables join the registries again', () => {
    const root = orderingProject('knex');

    write(root, AUDITED, withoutMarkers(read(root, AUDITED), 'events'));
    write(root, SCHEMA_INDEX, withoutMarkers(read(root, SCHEMA_INDEX), 'schemas'));
    force(root);

    expect(read(root, AUDITED)).toContain('  orderPlacedV1,\n');
    expect(read(root, SCHEMA_INDEX)).toContain('await createOrderingTables(knex);');
    expect(read(root, AUDITED).match(/import \{ orderPlacedV1 \}/g)).toHaveLength(1);
  });

  it('names a marker left without its partner', () => {
    const root = orderingProject('knex');
    const edited = read(root, AUDITED).replace('  // /ddd-ts-kit:events\n', '');

    write(root, AUDITED, edited);

    expect(force(root)).toContain(`${AUDITED}: the marker ddd-ts-kit:events has no partner`);
  });

  it('names the lines of a region whose two markers are gone, which the tree does not say', () => {
    const root = orderingProject('knex');
    const line = "'ordering.close': { enabled: false },";

    write(
      root,
      JOB_SETTINGS,
      withoutMarkers(read(root, JOB_SETTINGS), 'jobs').replace('  };\n', `    ${line}\n  };\n`),
    );

    const said = force(root);

    expect(said).toContain(`${JOB_SETTINGS}: --force could not keep 1 line(s) of "jobs" (${line})`);
    expect(said).toContain('generate job <context>');
  });
});

describe('init --force on a file with Windows line ends', () => {
  it('writes what it keeps with the line ends of the file it writes', () => {
    const root = orderingProject('knex');

    write(root, AUDITED, read(root, AUDITED).replaceAll('\n', '\r\n'));
    write(root, ROLES, read(root, ROLES).replaceAll('\n', '\r\n'));
    force(root);

    expect(read(root, AUDITED)).toContain('orderPlacedV1,');
    expect(read(root, AUDITED)).not.toContain('\r');
    expect(read(root, ROLES)).toContain("orderingPermissions['order.place']");
    expect(read(root, ROLES)).not.toContain('\r');
  });
});

describe('init --force that leaves an ORM', () => {
  it('says which repositories to generate again, and not that nothing is lost', () => {
    const root = orderingProject('drizzle');

    commitAll(root);

    const said = ok(cli(root, 'init', '--force', '--orm', 'knex')).stdout;

    expect(said).not.toContain(NOTHING_LOST);
    expect(said).toContain('ddd-ts-kit generate repository ordering Order`');
  });

  it('says that nothing is lost once each repository is there for the ORM of the project', () => {
    const root = orderingProject('drizzle');

    commitAll(root);
    ok(cli(root, 'init', '--force', '--orm', 'knex'));
    ok(cli(root, 'generate', 'repository', 'ordering', 'Order'));
    commitAll(root);

    expect(ok(cli(root, 'init', '--force')).stdout).toContain(NOTHING_LOST);
  });
});

describe('generate --grant on a roles file with a bracket in a comment', () => {
  it('reads the list of the role to its end', () => {
    const root = orderingProject('knex');

    write(root, ROLES, read(root, ROLES).replace("[Role.Admin]: ['*',", "[Role.Admin]: [ // keep ] bracket\n    '*',"));

    ok(
      cli(
        root,
        'generate',
        'command',
        'ordering',
        'CancelOrder',
        '--permission',
        'order.cancel',
        '--grant',
        'admin',
        '--term',
        'Cancel=Undo',
      ),
    );

    expect(read(root, ROLES)).toContain('[Role.Admin]: [ // keep ] bracket\n');
    expect(read(root, ROLES)).toContain("    orderingPermissions['order.cancel'],\n");
  });
});
