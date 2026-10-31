import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { aliasRoots } from '../src/alias';
import { BASELINE_FILE } from '../src/check/baseline/read-baseline';
import { parseConfig } from '../src/config';
import { movedSpecifier } from '../src/platform-folders/moved-specifier';
import { PLATFORM_LAYOUT } from '../src/platform-layout';
import { cli, exists, read, walk, write } from './helpers';
import { initProject } from './support/init-project';

const PLATFORM = 'src/platform';
const AUTH = `${PLATFORM}/auth`;

/** Each file of the platform in its folder, and where a version before the folders wrote it, both from the platform without extension. */
const FLAT: ReadonlyArray<readonly [string, string]> = PLATFORM_LAYOUT.flatMap(({ files }) => Object.entries(files))
  .map(([flat, placed]): readonly [string, string] => [placed.replace(/\.ts$/, ''), flat.replace(/\.ts$/, '')])
  .sort(([one], [other]) => other.length - one.length);

/** Every source of the project, by its path from the root, and its manifest. */
function sources(root: string): Record<string, string> {
  return Object.fromEntries([
    ...['src', 'test', 'scripts']
      .filter((directory) => exists(root, directory))
      .flatMap((directory) => walk(root, directory))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => [file, read(root, file)]),
    ['package.json', read(root, 'package.json')],
  ]);
}

function flatPath(file: string): string {
  const found = FLAT.find(([placed]) => file === `${PLATFORM}/${placed}.ts`);

  return found === undefined ? file : `${PLATFORM}/${found[1]}.ts`;
}

/** The project as a version of the kit before the folders wrote it: every file of the platform flat, named flat. */
function flatten(root: string): void {
  for (const [file, content] of Object.entries(sources(root))) {
    const flat = FLAT.reduce(
      (text, [placed, kept]) => text.replaceAll(`platform/${placed}`, `platform/${kept}`),
      content,
    );

    fs.rmSync(path.join(root, file));
    write(root, flatPath(file), flatPath(file) === file ? flat : flat.replaceAll("new URL('../../", "new URL('../"));
  }

  for (const folder of [
    'composition',
    'auth/authentication',
    'auth/authorization',
    'auth/roles',
    'auth/relationships',
  ]) {
    fs.rmSync(path.join(root, PLATFORM, folder), { recursive: true, force: true });
  }

  fs.rmSync(path.join(root, PLATFORM, 'audit/search-audit-entries'), { recursive: true, force: true });
}

describe('platform-folders, on a project generated before the folders of the platform', () => {
  it('puts every file back where a new project has it, and every import with it', () => {
    const root = initProject('--context', 'billing:core', '--authz', 'rebac');
    const expected = sources(root);

    flatten(root);

    expect(exists(root, `${AUTH}/relationship-schema.ts`)).toBe(true);
    expect(exists(root, `${PLATFORM}/compose-application.ts`)).toBe(true);
    expect(exists(root, `${PLATFORM}/audit/search-audit-entries.handler.ts`)).toBe(true);
    expect(read(root, 'package.json')).toContain(`--import ./${PLATFORM}/tracing.ts`);
    expect(cli(root, 'platform-folders').code).toBe(0);
    expect(sources(root)).toEqual(expected);
    expect(cli(root, 'platform-folders').stdout).toContain('Nothing to do');
  });

  it('keeps a discovered context found from the composition root it moved', () => {
    const root = initProject('--style', 'declared', '--assembly', 'discovery', '--context', 'billing:core');
    const expected = sources(root);
    const discovered = "await discoverContext('billing', new URL('../../contexts/billing/', import.meta.url))";

    expect(read(root, `${PLATFORM}/composition/compose-application.ts`)).toContain(discovered);

    flatten(root);

    expect(read(root, `${PLATFORM}/compose-application.ts`)).toContain(
      "await discoverContext('billing', new URL('../contexts/billing/', import.meta.url))",
    );

    expect(cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting', '--allow-name').code).toBe(0);

    expect(read(root, `${PLATFORM}/compose-application.ts`)).toContain(
      "await discoverContext('shipping', new URL('../contexts/shipping/', import.meta.url))",
    );

    cli(root, 'platform-folders');

    const composition = read(root, `${PLATFORM}/composition/compose-application.ts`);

    expect(composition).toContain(discovered);
    expect(composition).toContain("new URL('../../contexts/shipping/', import.meta.url)");

    expect(sources(root)[`${PLATFORM}/composition/lay-foundations.ts`]).toBe(
      expected[`${PLATFORM}/composition/lay-foundations.ts`],
    );
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

    expect(result.stdout).toContain(`would move    ${PLATFORM}/tracing.ts -> ${PLATFORM}/observability/tracing.ts`);
    expect(result.stdout).toContain('would rewrite src/main.ts');
    expect(sources(root)).toEqual(before);
  });

  it('is said by doctor until it ran, never failing --strict', () => {
    const root = initProject();

    flatten(root);

    const flat = cli(root, 'doctor', '--strict');

    expect(flat.stdout).toContain(`folder ${PLATFORM}: flat (composition/, observability/, jobs/, auth/<question>/`);
    expect(flat.stdout).not.toContain('script dev: written otherwise');

    expect(flat.stdout).toContain('ddd-ts-kit platform-folders` moves them to their folders');
    expect(flat.stdout).not.toContain('`npx ddd-ts-kit init` adds what is missing');

    cli(root, 'platform-folders');

    expect(cli(root, 'doctor').stdout).not.toContain(`folder ${PLATFORM}`);
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

  it('gives a new use case imports of the flat platform', () => {
    const root = initProject('--context', 'billing:core');

    flatten(root);

    expect(cli(root, 'generate', 'query', 'billing', 'SearchInvoices', '--allow-name', '--public').code).toBe(0);

    const written = Object.entries(sources(root)).filter(([, content]) =>
      FLAT.some(([placed]) => content.includes(`platform/${placed}'`) || content.includes(`platform/${placed}.js'`)),
    );

    expect(written.map(([file]) => file)).toEqual([]);
    expect(exists(root, `${PLATFORM}/composition`)).toBe(false);
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
    write(root, 'src/platform/http/uses-grants.ts', "export { roleGrants } from '../auth/role-grants.js';\n");

    const left = cli(root, 'platform-folders');

    expect(left.stdout).toContain(
      'Not written by the kit, left where folders only belong: auth/describe-grant.ts, auth/role-grants.ts.',
    );

    expect(read(root, `${AUTH}/role-grants.ts`)).toContain(
      "import { Role } from '@/platform/auth/authorization/role';",
    );

    const placed = cli(
      root,
      'platform-folders',
      '--place',
      'auth/role-grants.ts=auth/roles',
      '--place',
      'auth/describe-grant.ts=auth/roles',
    );

    expect(placed.code).toBe(0);
    expect(read(root, `${AUTH}/roles/role-grants.ts`)).toContain("import { describeGrant } from './describe-grant';");
    expect(exists(root, `${AUTH}/roles/describe-grant.ts`)).toBe(true);

    expect(read(root, 'src/platform/http/uses-grants.ts')).toBe(
      "export { roleGrants } from '../auth/roles/role-grants.js';\n",
    );

    expect(placed.stdout).not.toContain('left where');
  });

  it('refuses a --place that names no folder of the platform, a file the kit writes or no file', () => {
    const root = initProject();

    expect(cli(root, 'platform-folders', '--place', 'auth/role-grants.ts=grants').stderr).toContain(
      'Write --place <file>=<folder>',
    );

    expect(cli(root, 'platform-folders', '--place', 'auth/roles.ts=auth/authorization').stderr).toContain(
      'names a file the kit writes',
    );

    expect(cli(root, 'platform-folders', '--place', 'auth/role-grants.ts=auth/roles').stderr).toContain(
      'which does not exist',
    );
  });

  it('refuses a --place whose file leaves the platform, which it would report moved and could not move', () => {
    const root = initProject();
    const main = read(root, 'src/main.ts');

    write(root, 'outside-file.ts', 'export const outside = 1;\n');

    for (const file of ['../main.ts', '../../outside-file.ts', 'auth/../../main.ts', '/etc/hosts']) {
      const refused = cli(root, 'platform-folders', '--place', `${file}=composition`, '--json');

      expect(refused.code).toBe(2);

      expect(refused.json()).toEqual({
        error: {
          message: `--place ${file}=composition names ${file}, which is outside src/platform/: the command moves the files of the platform only.`,
          fix: 'Name a file by its path from src/platform/, as the command listed it: --place auth/role-grants.ts=auth/roles.',
        },
      });
    }

    const backslash = cli(root, 'platform-folders', '--place', '..\\main.ts=composition');

    expect(backslash.code).toBe(2);

    expect(backslash.stderr).toContain(
      'error: --place ..\\main.ts=composition names ..\\main.ts, written with a backslash: the kit reads paths with `/` only (on Windows, through WSL 2).',
    );

    expect(read(root, 'src/main.ts')).toBe(main);
    expect(exists(root, 'outside-file.ts')).toBe(true);
    expect(exists(root, 'src/platform/composition/main.ts')).toBe(false);
  });

  it('takes the errors the baseline records for a moved file to its new path', () => {
    const root = initProject();

    flatten(root);

    write(
      root,
      BASELINE_FILE,
      JSON.stringify({ [`${PLATFORM}/tracing.ts`]: { 'clean/no-escape-hatch': { count: 1 } } }, null, 2),
    );

    expect(cli(root, 'platform-folders').code).toBe(0);

    expect(JSON.parse(read(root, BASELINE_FILE))).toEqual({
      [`${PLATFORM}/observability/tracing.ts`]: { 'clean/no-escape-hatch': { count: 1 } },
    });
  });

  it('leaves alone an import of the directory of the file itself, which moves with it', () => {
    const roots = aliasRoots(parseConfig({}));
    const moved = new Map([[`${PLATFORM}/tracing`, `${PLATFORM}/observability/tracing`]]);

    expect(movedSpecifier('./', `${PLATFORM}/tracing.ts`, { roots, moved })).toBeUndefined();
    expect(movedSpecifier('.', `${PLATFORM}/tracing.ts`, { roots, moved })).toBeUndefined();
  });
});
