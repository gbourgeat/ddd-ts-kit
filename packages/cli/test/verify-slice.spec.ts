import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { commitFiles } from './support/commit-files.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';
import { jsonAt } from './support/json-at.js';

const SERVICE = 'src/contexts/billing/domain/services/pricing.service.ts';
const SPEC = 'src/contexts/billing/test/unit/pricing.service.spec.ts';
const IMPURE = "import { z } from 'zod';\n\nexport const pricing = z;\n";

let root: string;

/** Scripts that stand for the real ones: regenerate passes, the tests fail when FAIL is in their arguments' place. */
function withScripts(test: string): void {
  const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

  manifest.scripts['regenerate'] = 'node -e ""';
  manifest.scripts['test'] = test;
  write(root, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  git(root, 'commit', '--quiet', '--all', '--message', 'chore: scripts');
}

beforeEach(() => {
  root = committedProject('verify-slice', '--context', 'billing:core', '--package-manager', 'npm');
});

describe('verify-slice', () => {
  it('runs every step, reports a new file that breaks a rule and the failing tests, and exits 1', () => {
    withScripts('node -e "console.log(\'1 test failed\'); process.exit(1)"');
    git(root, 'switch', '--quiet', '--create', 'build/billing');
    write(root, SERVICE, IMPURE);

    const result = cli(root, 'verify-slice', 'billing', '--since', 'main');

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('regenerate: ok');
    expect(result.stdout).toContain('check (changed since main): ');
    expect(result.stdout).toContain(`${SERVICE}:1  error  layer/domain-purity`);
    expect(result.stdout).toContain('tests of billing: failed\n');
    expect(result.stdout).toContain('1 test failed');
    expect(result.stdout).toContain('next: fix the causes above, then run verify-slice again');
  });

  it('names the paths to stage and the files near the size limit when every step passes', () => {
    withScripts('node -e ""');
    git(root, 'switch', '--quiet', '--create', 'build/billing');
    const prices = Array.from({ length: 318 }, (_, line) => `  ${line},`).join('\n');

    write(root, SERVICE, `export const prices = [\n${prices}\n];\n`);
    write(root, SPEC, "import { it } from 'vitest';\n\nit('prices', () => undefined);\n");

    const result = cli(root, 'verify-slice', 'billing', '--since', 'main', '--json');
    const verification = result.json();

    expect(result.code).toBe(0);
    expect(jsonAt(verification, 'ok')).toBe(true);
    expect(jsonAt(verification, 'toStage')).toEqual([SERVICE, SPEC]);
    expect(jsonAt(verification, 'leftOut')).toEqual([]);
    expect(jsonAt(verification, 'nearTheLimit')).toEqual([{ file: SERVICE, lines: 320 }]);
  });

  it('never proposes to commit a file outside the slice, a private note at the root included, and says to leave it out', () => {
    withScripts('node -e ""');
    git(root, 'switch', '--quiet', '--create', 'build/billing');
    write(root, SERVICE, "export const pricing = 'priced';\n");
    write(root, SPEC, "import { it } from 'vitest';\n\nit('prices', () => undefined);\n");
    write(root, 'Synthèse privée.md', '# Not for the repository\n');
    write(root, '.idea/workspace.xml', '<project />\n');

    const result = cli(root, 'verify-slice', 'billing', '--since', 'main');
    const verification = cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json();

    expect(jsonAt(verification, 'toStage')).toEqual([SERVICE, SPEC]);

    expect(jsonAt(verification, 'leftOut')).toEqual(
      expect.arrayContaining(['Synthèse privée.md', '.idea/workspace.xml']),
    );

    expect(result.stdout).toContain('left out: changed or new, but not part of the slice; never stage them with it');
    expect(result.stdout.split('left out:')[0]).not.toContain('Synthèse');
  });
});

describe('verify-slice: the design of the rows and the merges of the branch', () => {
  it('lists the names the slice removes that the design of a row not done cites, without failing, its own rows left out', () => {
    const port = 'src/contexts/billing/application/ports/price-list.port.ts';

    const slices = [
      '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |',
      '|---|---|---|---|---|---|---|---|',
      '| M4.01 | billing | slice | Price an invoice | fill `PriceList` | | billing | done |',
      '| M4.02 | billing | slice | Discount an invoice | read `PriceList` | | billing | todo |',
    ].join('\n');

    withScripts('node -e ""');

    commitFiles(root, {
      message: 'feat(billing): price list',
      files: { [port]: 'export abstract class PriceList {}\n', 'docs/architecture/slices.md': `${slices}\n` },
    });

    git(root, 'switch', '--quiet', '--create', 'build/billing');
    fs.rmSync(path.join(root, port));

    const result = cli(root, 'verify-slice', 'billing', '--since', 'main');
    const verification = cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json();

    expect(result.code).toBe(0);

    expect(jsonAt(verification, 'citedRemovals')).toEqual([
      expect.objectContaining({
        cited: 'PriceList',
        document: 'docs/architecture/slices.md',
        line: 4,
        rows: ['M4.02'],
      }),
    ]);

    expect(result.stdout).toContain(
      'cited by the design of rows not done: names this slice removes (tell the conductor, as notes of your report)\n  `PriceList`: docs/architecture/slices.md:4 (#M4.02)',
    );

    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', rows: ['M4.02'] }));

    expect(jsonAt(cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json(), 'citedRemovals')).toEqual(
      [],
    );
  });

  it('reports, without failing the slice in this version, a merge of the trunk that lost a line of the branch', () => {
    const priced = (...lines: readonly string[]): string =>
      `export const prices = [\n  'standard',\n${lines.join('')}];\n`;

    withScripts('node -e ""');
    write(root, SERVICE, priced());
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'feat(billing): prices');
    git(root, 'switch', '--quiet', '--create', 'build/billing');
    write(root, SERVICE, priced("  'reduced',\n"));
    git(root, 'commit', '--quiet', '--all', '--message', 'feat(billing): reduced price');
    git(root, 'switch', '--quiet', 'main');
    write(root, SERVICE, priced("  'premium',\n"));
    git(root, 'commit', '--quiet', '--all', '--message', 'feat(billing): premium price');
    git(root, 'switch', '--quiet', 'build/billing');
    git(root, 'merge', '--quiet', '-X', 'theirs', 'main', '--message', 'Merge main into build/billing');

    const result = cli(root, 'verify-slice', 'billing', '--since', 'main');

    const answer = cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json();

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('merges since main: 1 error(s), not failing the slice in this version\n    merge ');
    expect(result.stdout).toContain(`        ${SERVICE}:3 (ours)  'reduced',`);

    expect(result.stdout).toContain(
      'a later minor version fails the slice on them; `npx ddd-ts-kit verify-merge` alone',
    );

    expect(jsonAt(answer, 'merges', 'ok')).toBe(false);
    expect(jsonAt(answer, 'ok')).toBe(true);
  });

  it('asks for the trunk, and for the scripts of this version', () => {
    const noTrunk = cli(root, 'verify-slice', 'billing');
    const manifest: { scripts: Record<string, string> } = JSON.parse(read(root, 'package.json'));

    delete manifest.scripts['regenerate'];
    write(root, 'package.json', JSON.stringify(manifest));

    const noScript = cli(root, 'verify-slice', 'billing', '--since', 'main');

    expect(noTrunk.code).toBe(2);
    expect(noTrunk.stderr).toContain('--since origin/main');
    expect(noScript.code).toBe(2);
    expect(noScript.stderr).toContain('init --force');
  });
});

describe('verify-slice in the worktree of a worker', () => {
  const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| M1.01 | billing | slice | Price an invoice | \`generate domain-service billing Pricing\` | | billing | todo |
| M1.02 | billing | slice | Discount an invoice | \`generate domain-service billing Discount\` | | billing | todo |
`;

  it('prints the commit command naming the first row not committed, and keeps its verification for the conductor', () => {
    withScripts('node -e ""');
    write(root, 'docs/architecture/slices.md', SLICES);
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'docs: slices');
    git(root, 'switch', '--quiet', '--create', 'build/billing');

    write(
      root,
      '.ddd-ts-kit/worker.json',
      JSON.stringify({ context: 'billing', rows: ['M1.01', 'M1.02'], base: 'main' }),
    );

    write(root, SERVICE, "export const pricing = 'priced';\n");
    write(root, SPEC, "import { it } from 'vitest';\n\nit('prices', () => undefined);\n");

    const first = cli(root, 'verify-slice', 'billing', '--since', 'main');

    expect(first.code).toBe(0);
    expect(first.stdout).toContain('next: stage these paths one by one, then commit the slice with this command:\n');
    expect(first.stdout).toContain('  git commit -m "feat(billing): price an invoice" -m "Slice: M1.01"');

    expect(JSON.parse(read(root, '.ddd-ts-kit/verification.json'))).toEqual({
      at: expect.any(String),
      head: git(root, 'rev-parse', 'HEAD').trim(),
      row: 'M1.01',
      ok: true,
      failed: [],
      toStage: [SERVICE, SPEC],
    });

    git(root, 'add', SERVICE, SPEC);
    git(root, 'commit', '--quiet', '--message', 'feat(billing): price an invoice', '--message', 'Slice: M1.01');

    const second = cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json();

    expect(jsonAt(second, 'row')).toBe('M1.02');
    expect(jsonAt(second, 'commit')).toBe('git commit -m "feat(billing): discount an invoice" -m "Slice: M1.02"');
  });

  it('writes nothing outside a worker, and says the failed steps in its record', () => {
    withScripts('node -e "process.exit(1)"');
    write(root, SERVICE, IMPURE);

    expect(cli(root, 'verify-slice', 'billing', '--since', 'main', '--json').json()).not.toHaveProperty('row');
    expect(fs.existsSync(path.join(root, '.ddd-ts-kit/verification.json'))).toBe(false);

    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', rows: ['9'], base: 'main' }));
    cli(root, 'verify-slice', 'billing', '--since', 'main');

    expect(JSON.parse(read(root, '.ddd-ts-kit/verification.json'))).toMatchObject({
      row: '9',
      ok: false,
      failed: ['check', 'tests'],
    });
  });
});
