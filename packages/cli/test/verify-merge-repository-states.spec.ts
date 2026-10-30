import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { git } from './support/git';
import { BOTH_KEPT, INVOICE, PAY_AND_CANCEL, spec } from './support/invoicing-merge';
import { jsonAt } from './support/json-at';
import { commit, mergeRepository, mergeWith, startMerge } from './support/merge-repository';

const PAY_SPEC = 'src/contexts/billing/pay-invoice.spec.ts';

function kinds(answer: unknown, key: 'errors' | 'repaired' = 'errors'): string[] {
  const findings = jsonAt(answer, 'merges', '0', key);

  return Array.isArray(findings) ? findings.map((finding) => String(jsonAt(finding, 'kind'))) : [];
}

const lines = (...body: readonly string[]): string => ['export class Invoice {', ...body, '}', ''].join('\n');

describe('verify-merge, what the repository holds of a merge', () => {
  it('reports a spec file both sides kept that the merge deleted as deleted from both', () => {
    const root = mergeRepository({
      base: { [INVOICE]: lines('  issue() {}'), [PAY_SPEC]: spec(['pays an issued invoice', 'pay']) },
      ours: { [INVOICE]: lines('  issue() {}', '  pay() {}') },
      theirs: { [INVOICE]: lines('  issue() {}', '  cancel() {}') },
    });

    mergeWith(root, { [PAY_SPEC]: null });

    expect(cli(root, 'verify-merge', 'HEAD').stdout).toContain(`spec files deleted:\n    ${PAY_SPEC} (both)`);
  });

  it('keeps reporting the conflict markers of a merge while a later commit still holds them', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    write(root, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing', base: 'main' }));
    startMerge(root, {});
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--no-edit');
    commit(root, { 'docs/notes.md': 'Later.\n' }, 'docs: later');

    const later = cli(root, 'verify-merge', '--json');

    expect(later.code).toBe(1);
    expect(kinds(later.json())).toContain('conflict-marker');
    expect(kinds(later.json(), 'repaired')).not.toContain('conflict-marker');
  });

  it('reads a merge in progress whose message git no longer holds as one without trailers', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    startMerge(root, {}, '-X', 'theirs');
    fs.rmSync(path.join(root, '.git', 'MERGE_MSG'));

    const text = cli(root, 'verify-merge').stdout;

    expect(text).toMatch(/^merge in progress \(HEAD <- [0-9a-f]{7}\) "merge in progress": 8 error\(s\)/);
  });
});

describe('verify-merge, a merge whose base git cannot give', () => {
  it('refuses a merge of two histories without a common ancestor, unless its base is named', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    git(root, 'checkout', '--quiet', '--orphan', 'elsewhere');
    git(root, 'rm', '-rq', '--cached', '.');
    fs.rmSync(path.join(root, 'src'), { recursive: true, force: true });
    fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true });
    write(root, 'README.md', '# Elsewhere\n');
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'chore: another history');
    git(root, 'checkout', '--quiet', 'build/billing');
    git(root, 'merge', '--quiet', '--allow-unrelated-histories', '--no-edit', 'elsewhere');

    const refused = cli(root, 'verify-merge', 'HEAD');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toMatch(
      /[0-9a-f]{7} and [0-9a-f]{7} have no common ancestor: the merge has no base to compare with\./,
    );

    expect(refused.stderr).toContain('fix: Name it: `--base <commit>`.');
    expect(cli(root, 'verify-merge', 'HEAD', '--base', 'main').code).toBe(0);
  });

  it('says which git command could not run in a repository that lacks the tree of the base', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    mergeWith(root, BOTH_KEPT);

    const tree = git(root, 'rev-parse', 'main^^{tree}').trim();

    fs.rmSync(path.join(root, '.git', 'objects', tree.slice(0, 2), tree.slice(2)));

    const refused = cli(root, 'verify-merge', 'HEAD');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('error: git could not run `git diff --name-only -z --no-renames');
    expect(refused.stderr).toContain('a shallow clone lacks them: fetch with --unshallow');
  });
});
