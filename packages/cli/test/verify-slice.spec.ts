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
