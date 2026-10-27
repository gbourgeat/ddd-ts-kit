import { describe, expect, it } from 'vitest';
import { exists, read, write } from './helpers';
import { git } from './support/git';
import { commitFiles, goOn, mergeTrunk, merging, onBranch, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';
const CONTEXT = 'src/contexts/billing/CONTEXT.md';
const STATE = '.ddd-ts-kit/merge.json';

/** `regenerate` rewrites the CONTEXT.md the trunk changed, then exits with `code`. */
function regenerating(code: number): string {
  const script = `require('fs').appendFileSync('${CONTEXT}', 'regenerated\\n'); process.exit(${code})`;

  return JSON.stringify({ name: 'billing', scripts: { regenerate: `node -e "${script}"` } });
}

/** The trunk changes CONTEXT.md (merged cleanly, so staged) and the invoice (a conflict); the conflict is settled by hand. */
function settled(code: number): string {
  const root = trunkRepository({
    [INVOICE]: 'class Invoice {\n}\n',
    [CONTEXT]: '# billing\n',
    'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
    'package.json': regenerating(code),
  });

  onBranch(root, 'build/billing');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
  onBranch(root, 'main');

  commitFiles(
    root,
    { [INVOICE]: 'class Invoice {\n  cancel() {}\n}\n', [CONTEXT]: '# billing\nterm\n' },
    'feat: cancel (#2)',
  );

  onBranch(root, 'build/billing');

  expect(mergeTrunk(root).code).toBe(1);

  write(root, INVOICE, 'class Invoice {\n  pay() {}\n  cancel() {}\n}\n');
  git(root, 'add', INVOICE);

  return root;
}

describe('merge-trunk: a file it regenerates', () => {
  it('is staged again after the regeneration, so that the merge in progress can be aborted', () => {
    const root = settled(3);

    expect(goOn(root, '--continue').code).toBe(1);
    expect(git(root, 'status', '--porcelain', '--', CONTEXT).trim()).toBe(`M  ${CONTEXT}`);

    const aborted = goOn(root, '--abort');

    expect(aborted.code).toBe(0);
    expect(merging(root)).toBe(false);
    expect(exists(root, STATE)).toBe(false);
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
  }, 60_000);

  it('is restored by --abort, which names it, when it was modified after being staged', () => {
    const root = settled(0);

    git(root, 'add', CONTEXT);
    write(root, CONTEXT, `${read(root, CONTEXT)}edited after staging\n`);

    expect(git(root, 'status', '--porcelain', '--', CONTEXT).trim()).toBe(`MM ${CONTEXT}`);

    const aborted = goOn(root, '--abort');

    expect(aborted.code).toBe(0);
    expect(aborted.stdout).toContain(`discarded, the kit regenerates it: ${CONTEXT}`);
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
  }, 60_000);

  it('does not let --abort discard a file the person changed by hand', () => {
    const root = settled(0);

    git(root, 'add', CONTEXT);
    write(root, CONTEXT, `${read(root, CONTEXT)}edited after staging\n`);
    write(root, INVOICE, 'class Invoice {\n  pay() {}\n  cancel() {}\n  mine() {}\n}\n');

    const refused = goOn(root, '--abort');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(INVOICE);
    expect(merging(root)).toBe(true);
    expect(read(root, INVOICE)).toContain('mine()');
  }, 60_000);
});
