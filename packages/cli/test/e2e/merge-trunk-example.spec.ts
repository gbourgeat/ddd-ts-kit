import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, REPO_ROOT, tempDir, write } from '../helpers.js';
import { git } from '../support/git.js';
import { commitFiles, squashInto } from '../support/trunk-history.js';
import { SLOW } from './stacks.js';

const EXAMPLE = path.join(REPO_ROOT, 'examples/scheduling');
const NOT_COPIED = ['node_modules', 'dist', 'coverage', '.ddd-ts-kit'];
const SLICES = 'docs/architecture/slices.md';
const GLOSSARY = 'src/contexts/identity/CONTEXT.md';

let root: string;
let registering: string;
let opening: string;

/** The slices file of `directory` with the status of row `id` set. */
function marked(directory: string, id: string, status: string): string {
  return read(directory, SLICES).replace(
    new RegExp(`^(\\| ${id.replace('.', '\\.')} \\|.*\\| )[a-z ]+( \\|)$`, 'm'),
    `$1${status}$2`,
  );
}

/** The glossary of identity with a row added after the row of `after`. */
function withTerm(directory: string, after: string, row: string): string {
  return read(directory, GLOSSARY).replace(new RegExp(`^(\\| ${after} \\|.*)$`, 'm'), `$1\n${row}`);
}

/**
 * The copy has no node_modules and its scripts reach the CLI of the repository by a relative
 * path: merge-trunk skips the regeneration there, as in a project without the script.
 */
function withoutRegenerate(directory: string): void {
  const manifest = JSON.parse(read(directory, 'package.json')) as { scripts: Partial<Record<string, string>> };

  delete manifest.scripts['regenerate'];
  write(directory, 'package.json', JSON.stringify(manifest, null, 2) + '\n');
}

function worker(rows: string, place: string, branch: string): void {
  const opened = cli(
    root,
    'worker-scope',
    'identity',
    '--rows',
    rows,
    '--worktree',
    place,
    '--branch',
    branch,
    '--no-install',
  );

  expect(opened.code, opened.stderr).toBe(0);
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a copy of the example application with two workers of
 * identity; the first is squash-merged, the second brings the trunk in with merge-trunk, then the
 * first worktree is reused for its next row and brings the trunk in from where it landed.
 */
describe.runIf(SLOW)('merge-trunk on a copy of the example application', () => {
  beforeAll(() => {
    const parent = fs.realpathSync(tempDir('merge-trunk-example'));

    root = path.join(parent, 'scheduling');
    registering = path.join(parent, 'scheduling-register');
    opening = path.join(parent, 'scheduling-open');
    fs.cpSync(EXAMPLE, root, { recursive: true, filter: (source) => !NOT_COPIED.includes(path.basename(source)) });
    withoutRegenerate(root);
    git(root, 'init', '--quiet', '--initial-branch', 'main');
    commitFiles(root, {}, 'chore: the example application');
    worker('M1.11', registering, 'build/identity-register');
    worker('M1.12', opening, 'build/identity-open');

    commitFiles(
      registering,
      {
        [SLICES]: marked(registering, 'M1.11', 'done'),
        [GLOSSARY]: withTerm(
          registering,
          'Register',
          '| Sign-in | The first visit of a person, which registers them |  |',
        ),
        'src/contexts/identity/application/sign-in-grace.ts': 'export const SIGN_IN_GRACE_DAYS = 30;\n',
      },
      'feat(identity): register a person',
    );

    commitFiles(
      opening,
      {
        [SLICES]: marked(opening, 'M1.12', 'done'),
        [GLOSSARY]: withTerm(opening, 'Role', '| Opening | The day a practice starts receiving people |  |'),
        'src/contexts/identity/application/opening-notice.ts': 'export const OPENING_NOTICE_DAYS = 7;\n',
      },
      'feat(identity): open a practice',
    );

    squashInto(root, 'build/identity-register', { message: 'feat(identity): register a person (#1)' });
  }, 120_000);

  it('brings the trunk into the second worker: the slices rows settled, nothing lost, the documents still current', () => {
    const merged = cli(opening, 'merge-trunk', '--trunk', 'main');

    expect(merged.code, merged.stdout).toBe(0);
    expect(merged.stdout).toContain('conflicts: plain git merge 1, own diff since base 1, automatic 1, for you 0');

    expect(merged.stdout).toContain(
      `  ${SLICES}  slices rows: merged row by row, each status the furthest of both sides`,
    );

    expect(marked(opening, 'M1.11', 'done')).toBe(read(opening, SLICES));
    expect(marked(opening, 'M1.12', 'done')).toBe(read(opening, SLICES));
    expect(cli(opening, 'verify-merge', '--since', 'main').code).toBe(0);
    expect(cli(opening, 'docs', '--check').code).toBe(0);
  }, 120_000);

  it('brings the trunk into the reused first worktree from where it landed, the row it builds next kept', () => {
    squashInto(root, 'build/identity-open', { message: 'feat(identity): open a practice (#2)' });
    write(registering, SLICES, marked(registering, 'M1.13', 'in progress'));

    const reworded = withTerm(registering, 'Add', '| Invite | To ask a person to become a member |  |').replace(
      'The first visit of a person, which registers them',
      'The first sign-in of a person, which registers them',
    );

    commitFiles(registering, { [GLOSSARY]: reworded }, 'feat(identity): add a member');

    const merged = cli(registering, 'merge-trunk', '--trunk', 'main', '--json');
    const report = merged.json();

    expect(merged.code, merged.stdout).toBe(0);

    expect(report).toMatchObject({
      status: 'committed',
      base: { evidence: 'landed', landedAs: { subject: 'feat(identity): register a person (#1)' } },
      conflicts: { plainMerge: 2, ownDiff: 1, automatic: 1, forYou: 0 },
      lostLines: { errors: [] },
    });

    expect(cli(registering, 'verify-merge', '--since', 'main').code).toBe(0);
    expect(cli(registering, 'docs', '--check').code).toBe(0);
    expect(read(registering, GLOSSARY)).toContain('| Opening |');
    expect(read(registering, GLOSSARY)).toContain('| Invite |');
    expect(read(registering, GLOSSARY)).toContain('| Sign-in | The first sign-in of a person, which registers them |');
  }, 120_000);
});
