import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read, walk, write } from './helpers.js';
import { initProject } from './support/init-project.js';

const AUTH = 'src/platform/auth';
const FOLDER = /\/auth\/(?:authentication|authorization|roles|attributes|relationships|custom)\//g;

/** Every source of the project, by its path from the root. */
function sources(root: string): Record<string, string> {
  return Object.fromEntries(
    ['src', 'test', 'scripts']
      .filter((directory) => exists(root, directory))
      .flatMap((directory) => walk(root, directory))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => [file, read(root, file)]),
  );
}

/** The project as a version of the kit before the folders wrote it: every file of auth flat, imported flat. */
function flatten(root: string): void {
  for (const [file, content] of Object.entries(sources(root))) {
    const target = file.startsWith(`${AUTH}/`) ? `${AUTH}/${path.posix.basename(file)}` : file;

    fs.rmSync(path.join(root, file));
    write(root, target, content.replace(FOLDER, '/auth/'));
  }

  for (const folder of fs.readdirSync(path.join(root, AUTH))) {
    if (fs.statSync(path.join(root, AUTH, folder)).isDirectory()) {
      fs.rmSync(path.join(root, AUTH, folder), { recursive: true });
    }
  }
}

describe('platform-folders, on a project generated before the folders of auth', () => {
  it('puts every file back where a new project has it, and every import with it', () => {
    const root = initProject('--context', 'billing:core', '--authz', 'rebac');
    const expected = sources(root);

    flatten(root);

    expect(exists(root, `${AUTH}/relationship-schema.ts`)).toBe(true);
    expect(cli(root, 'platform-folders').code).toBe(0);
    expect(sources(root)).toEqual(expected);
    expect(cli(root, 'platform-folders').stdout).toContain('Nothing to do');
  });

  it('shows what it would move with --dry-run, and moves nothing', () => {
    const root = initProject();

    flatten(root);

    const before = sources(root);
    const result = cli(root, 'platform-folders', '--dry-run');

    expect(result.stdout).toContain(`would move    ${AUTH}/roles.ts -> ${AUTH}/roles/roles.ts`);

    expect(result.stdout).toContain(
      `would move    ${AUTH}/create-authenticator.ts -> ${AUTH}/authentication/create-authenticator.ts`,
    );

    expect(result.stdout).toContain('would rewrite src/main.ts');
    expect(sources(root)).toEqual(before);
  });

  it('is said by doctor until it ran, never failing --strict', () => {
    const root = initProject();

    flatten(root);

    const flat = cli(root, 'doctor', '--strict');

    expect(flat.stdout).toContain(
      `folder ${AUTH}: flat (authentication/, authorization/ and the folder of the model; yours: `,
    );

    expect(flat.stdout).toContain('ddd-ts-kit platform-folders` moves them to their folders');
    expect(flat.stdout).not.toContain('`npx ddd-ts-kit init` adds what is missing');

    cli(root, 'platform-folders');

    expect(cli(root, 'doctor').stdout).not.toContain(`folder ${AUTH}`);
  });

  it('is kept flat by init --force, which says how to move it', () => {
    const root = initProject('--authz', 'rebac');
    const expected = sources(root);

    flatten(root);

    const flat = sources(root);
    const forced = cli(root, 'init', '--force', '--json');

    expect(forced.code).toBe(0);
    expect(sources(root)).toEqual(flat);
    expect(forced.stdout).toContain('ddd-ts-kit platform-folders` moves them');

    cli(root, 'platform-folders');

    expect(sources(root)).toEqual(expected);
  });

  it('lets the generators write in the flat files until then', () => {
    const root = initProject('--context', 'billing:core');

    flatten(root);

    const generated = cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--allow-name',
      '--permission',
      'invoice.issue',
      '--grant',
      'accountant',
    );

    expect(generated.code).toBe(0);
    expect(read(root, `${AUTH}/role.ts`)).toContain("Accountant: 'accountant',");
    expect(read(root, `${AUTH}/roles.ts`)).toContain("[Role.Accountant]: [billingPermissions['invoice.issue']],");
    expect(exists(root, `${AUTH}/roles`)).toBe(false);
    expect(exists(root, `${AUTH}/authorization`)).toBe(false);
  });
});

describe('platform-folders, on the files of the team', () => {
  const GRANTS = [
    "import { Role } from '@/platform/auth/role';",
    "import { describeGrant } from './describe-grant';",
    '',
    'export const roleGrants = [describeGrant(Role.Admin)];',
    '',
  ].join('\n');

  it('names what it leaves flat, and moves it with --place, its imports and those of others following', () => {
    const root = initProject();

    flatten(root);
    write(root, `${AUTH}/role-grants.ts`, GRANTS);
    write(root, `${AUTH}/describe-grant.ts`, 'export const describeGrant = (role: string): string => role;\n');
    write(root, 'src/platform/uses-grants.ts', "export { roleGrants } from './auth/role-grants.js';\n");

    const left = cli(root, 'platform-folders');

    expect(left.stdout).toContain('Not written by the kit, left flat: describe-grant.ts, role-grants.ts.');

    expect(read(root, `${AUTH}/role-grants.ts`)).toContain(
      "import { Role } from '@/platform/auth/authorization/role';",
    );

    const placed = cli(
      root,
      'platform-folders',
      '--place',
      'role-grants.ts=roles',
      '--place',
      'describe-grant.ts=roles',
    );

    expect(placed.code).toBe(0);
    expect(read(root, `${AUTH}/roles/role-grants.ts`)).toContain("import { describeGrant } from './describe-grant';");
    expect(exists(root, `${AUTH}/roles/describe-grant.ts`)).toBe(true);

    expect(read(root, 'src/platform/uses-grants.ts')).toBe(
      "export { roleGrants } from './auth/roles/role-grants.js';\n",
    );

    expect(placed.stdout).not.toContain('left flat');
  });

  it('refuses a --place that names no folder of auth, or a file the kit writes', () => {
    const root = initProject();

    expect(cli(root, 'platform-folders', '--place', 'role-grants.ts=grants').stderr).toContain(
      'Write --place <file>=<folder>',
    );

    expect(cli(root, 'platform-folders', '--place', 'roles.ts=authorization').stderr).toContain(
      'names a file the kit writes',
    );
  });
});
