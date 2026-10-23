import { describe, expect, it } from 'vitest';
import { cli, exists, read, write } from './helpers';
import { git } from './support/git';
import { BOTH_KEPT, INVOICE, PAY_AND_CANCEL, ROUTES, SLICES, SPEC, invoice, PAY } from './support/invoicing-merge';
import { mergeRepository } from './support/merge-repository';
import { goOn, lastMessage, mergeTrunk, merging, parents } from './support/trunk-history';

const STATE = '.ddd-ts-kit/merge.json';

/** The branch pays, the trunk cancels, in the same places; merge-trunk settles the routes and the slices, the rest is left. */
function stoppedOnSources(): string {
  const root = mergeRepository(PAY_AND_CANCEL);

  write(root, '.gitignore', '.ddd-ts-kit/\n');
  git(root, 'add', '.gitignore');
  git(root, 'commit', '--quiet', '--message', 'chore: ignore the kit folder');

  expect(mergeTrunk(root).code).toBe(1);

  return root;
}

function resolveBoth(root: string): void {
  write(root, INVOICE, BOTH_KEPT[INVOICE]);
  write(root, SPEC, BOTH_KEPT[SPEC]);
  git(root, 'add', INVOICE, SPEC);
}

describe('merge-trunk: a merge left to a person, then --continue', () => {
  it('stops on the source hunks with a merge in progress git understands, the settled paths staged, and its state recorded', () => {
    const root = mergeRepository(PAY_AND_CANCEL);
    const result = mergeTrunk(root);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('conflicts: plain git merge 4, own diff since base 4, automatic 2, for you 2');
    expect(result.stdout).toContain(`  ${ROUTES}  generated registry: the lines of both sides kept`);

    expect(result.stdout).toContain(
      `  ${SLICES}  slices rows: merged row by row, each status the furthest of both sides`,
    );

    expect(result.stdout).toContain(`  ${INVOICE}  hunks at lines`);
    expect(result.stdout).toContain('    ours  (build/billing): adds 4 lines: pay(amount: Money, at: Date): void {');
    expect(result.stdout).toContain('"feat(billing): theirs"): adds 3 lines: cancel(reason: CancelReason): void {');
    expect(result.stdout).toContain('    both sides only add lines: keep both. Never take one side of the whole file.');

    expect(result.stdout).toContain(
      'next: resolve each hunk, `git add <file>`, then `npx ddd-ts-kit merge-trunk --continue`',
    );

    expect(git(root, 'status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean).sort()).toEqual([
      `M  ${SLICES}`,
      `M  ${ROUTES}`,
      `UU ${SPEC}`,
      `UU ${INVOICE}`,
    ]);

    expect(merging(root)).toBe(true);
    expect(read(root, ROUTES)).toBe(BOTH_KEPT[ROUTES]);

    expect(JSON.parse(read(root, STATE))).toMatchObject({
      toLand: false,
      report: { status: 'stopped', forYou: [{ file: SPEC }, { file: INVOICE }] },
    });
  });

  it('refuses to go on while a file keeps its conflict markers, even staged', () => {
    const root = stoppedOnSources();

    git(root, 'add', INVOICE, SPEC);

    const refused = goOn(root, '--continue');

    expect(refused.code).toBe(1);
    expect(refused.stdout).toContain(`stopped: conflict markers left in ${SPEC}, ${INVOICE}`);
    expect(merging(root)).toBe(true);
  });

  it('commits the merge with both parents and its trailers once every hunk keeps both sides, and forgets its state', () => {
    const root = stoppedOnSources();
    const branch = git(root, 'rev-parse', 'HEAD').trim();

    resolveBoth(root);

    const done = goOn(root, '--continue');

    expect(done.code).toBe(0);
    expect(done.stdout).toContain(`settled by you: ${SPEC}, ${INVOICE}`);
    expect(done.stdout).toContain('lost lines: none lost');
    expect(done.stdout).toMatch(/committed [0-9a-f]{7} "Merge main into build\/billing"/);
    expect(parents(root)).toEqual([branch, git(root, 'rev-parse', 'main').trim()]);
    expect(lastMessage(root)).toContain(`Merge-Base: ${git(root, 'merge-base', branch, 'main').trim()}\nTrunk: `);
    expect(exists(root, STATE)).toBe(false);
    expect(cli(root, 'verify-merge', '--since', 'main').code).toBe(0);
  });

  it('stops on a hunk resolved by taking one side, then records the loss a person accepts', () => {
    const root = stoppedOnSources();

    resolveBoth(root);
    write(root, INVOICE, invoice());
    git(root, 'add', INVOICE);

    const stopped = goOn(root, '--continue', '--json');

    expect(stopped.code).toBe(1);

    expect(stopped.json()).toMatchObject({
      status: 'stopped',
      lostLines: {
        errors: expect.arrayContaining([
          { kind: 'lost-line', file: INVOICE, line: 8, side: 'ours', text: PAY[0]?.trim() },
        ]),
      },
    });

    const accepted = goOn(root, '--continue', '--accept-lost');

    expect(accepted.code).toBe(0);
    expect(accepted.stdout).toContain('accepted (Lost-Accepted):');
    expect(lastMessage(root)).toMatch(new RegExp(`Lost-Accepted: ${INVOICE}:\\d+`));
  });
});

describe('merge-trunk: what the person does around the merge', () => {
  it('keeps its trailers when the person commits with git, and verify-merge reads the base from them', () => {
    const root = stoppedOnSources();

    resolveBoth(root);
    git(root, 'commit', '--quiet', '--no-edit');

    expect(lastMessage(root)).toMatch(
      /^Merge main into build\/billing\n\nMerge-Base: [0-9a-f]{40}\nTrunk: [0-9a-f]{40}\n/,
    );

    expect(cli(root, 'verify-merge', '--since', 'main', '--json').json()).toMatchObject({
      ok: true,
      merges: [{ baseFrom: 'trailer' }],
    });
  });

  it('blocks the commit on a changed path that is not the merge, until it is staged or set aside', () => {
    const root = stoppedOnSources();

    resolveBoth(root);
    write(root, 'notes.md', 'A note.\n');

    const blocked = goOn(root, '--continue', '--json');

    expect(blocked.code).toBe(1);
    expect(blocked.json()).toMatchObject({ status: 'stopped', leftOut: ['notes.md'] });
    expect(merging(root)).toBe(true);

    git(root, 'add', 'notes.md');

    expect(goOn(root, '--continue').code).toBe(0);
  });

  it('undoes the merge with --abort, and says when nothing is in progress', () => {
    const root = stoppedOnSources();
    const head = git(root, 'rev-parse', 'HEAD').trim();

    const aborted = goOn(root, '--abort');

    expect(aborted.code).toBe(0);
    expect(aborted.stdout).toContain('merge aborted: the branch is back at');
    expect(merging(root)).toBe(false);
    expect(exists(root, STATE)).toBe(false);
    expect(git(root, 'rev-parse', 'HEAD').trim()).toBe(head);
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
    expect(goOn(root, '--abort').code).toBe(2);
    expect(goOn(root, '--continue').stderr).toContain('No merge of merge-trunk is in progress in this worktree.');
  });
});

describe('merge-trunk: a preview, a branch up to date, and the refusals', () => {
  it('changes nothing with --dry-run', () => {
    const root = mergeRepository(PAY_AND_CANCEL);
    const head = git(root, 'rev-parse', 'HEAD').trim();
    const preview = mergeTrunk(root, '--dry-run');

    expect(preview.code).toBe(0);
    expect(preview.stdout).toContain('merge-trunk build/billing <- main');
    expect(preview.stdout).toContain(', dry run: nothing changed');
    expect(preview.stdout).toContain('for you (once the merge starts):');
    expect(merging(root)).toBe(false);
    expect(git(root, 'rev-parse', 'HEAD').trim()).toBe(head);
    expect(git(root, 'status', '--porcelain').trim()).toBe('');
  });

  it('says the branch is up to date when it holds the trunk', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    git(root, 'switch', '--quiet', 'main');

    expect(mergeTrunk(root).stdout).toBe(
      'merge-trunk main <- main (' +
        git(root, 'rev-parse', '--short=7', 'main').trim() +
        ')\nnext: nothing to merge: the branch already holds the trunk',
    );
  });

  it('refuses a dirty tree, another operation in progress, an unknown trunk and options that do not go together', () => {
    const root = mergeRepository(PAY_AND_CANCEL);

    write(root, INVOICE, 'changed\n');
    expect(mergeTrunk(root).stderr).toContain(`The working tree is not clean: ${INVOICE}.`);
    git(root, 'checkout', '--', INVOICE);

    expect(cli(root, 'merge-trunk').stderr).toContain('neither origin/HEAD nor origin/main names a commit');
    expect(mergeTrunk(root, '--trunk', 'nowhere').code).toBe(2);
    expect(goOn(root, '--continue', '--abort').code).toBe(2);
    expect(goOn(root, '--continue', '--trunk', 'main').stderr).toContain('--trunk starts a merge');
    expect(goOn(root, '--accept-lost').stderr).toContain('--accept-lost records');

    try {
      git(root, 'merge', 'main');
    } catch {
      // The conflict leaves the merge in progress.
    }

    const refused = mergeTrunk(root);

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('a merge is in progress in this worktree.');
    expect(goOn(root, '--continue').stderr).toContain('The merge in progress was not started by merge-trunk');
  });
});
