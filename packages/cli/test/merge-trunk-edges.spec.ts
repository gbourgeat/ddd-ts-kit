import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, write } from './helpers.js';
import { DRIZZLE_KIT_STUB } from './support/drizzle-kit-stub.js';
import { git } from './support/git.js';
import { IDENTITY_VARIABLES } from './support/git-identity.js';
import { commitFiles, goOn, mergeTrunk, merging, onBranch, trunkRepository } from './support/trunk-history.js';

const INVOICE = 'src/contexts/billing/invoice.ts';
const manifest = (regenerate: string): string => JSON.stringify({ name: 'billing', scripts: { regenerate } });

/** The branch adds pay(), the trunk cancel(), at one place of the invoice; `base` is committed first. */
function conflicting(base: Record<string, string> = {}): string {
  const root = trunkRepository({ [INVOICE]: 'class Invoice {\n}\n', ...base });

  onBranch(root, 'build/billing');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
  onBranch(root, 'main');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  cancel() {}\n}\n' }, 'feat(billing): cancel (#2)');
  onBranch(root, 'build/billing');

  return root;
}

function resolved(root: string): void {
  write(root, INVOICE, 'class Invoice {\n  pay() {}\n  cancel() {}\n}\n');
  git(root, 'add', INVOICE);
}

describe('merge-trunk: what stops it after the conflicts', () => {
  it('runs the regenerate script of a project, and stops while it fails', () => {
    const root = conflicting({
      'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
      'package.json': manifest('node -e "process.exit(3)"'),
    });

    expect(mergeTrunk(root).code).toBe(1);
    resolved(root);

    const failed = goOn(root, '--continue', '--json');

    expect(failed.code).toBe(1);

    expect(failed.json()).toMatchObject({
      status: 'stopped',
      regenerate: { status: 'failed' },
      stop: '`npm run regenerate` failed',
    });

    write(root, 'package.json', manifest('node -e ""'));
    git(root, 'add', 'package.json');

    expect(goOn(root, '--continue', '--json').json()).toMatchObject({
      status: 'committed',
      regenerate: { status: 'ok' },
    });
  }, 60_000);

  it('says why the regenerate step is skipped in a project without the script', () => {
    const root = conflicting({ 'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }), 'package.json': '{}' });

    mergeTrunk(root);
    resolved(root);

    expect(goOn(root, '--continue').stdout).toContain('regenerate: skipped, package.json has no "regenerate" script');
  });

  it('stops on a path still unmerged, and on a commit the hooks of the project refuse', () => {
    const root = conflicting();

    mergeTrunk(root);

    expect(goOn(root, '--continue').stdout).toContain(`stopped: still unmerged: ${INVOICE}`);

    resolved(root);
    write(root, '.git/hooks/pre-commit', '#!/bin/sh\necho "the hook refuses"\nexit 1\n');
    fs.chmodSync(path.join(root, '.git/hooks/pre-commit'), 0o755);

    const refused = goOn(root, '--continue');

    expect(refused.code).toBe(1);
    expect(refused.stdout).toContain('stopped: git commit refused:\nthe hook refuses');
    expect(merging(root)).toBe(true);
  });
});

describe('merge-trunk: a deleted file, a drizzle refusal, and the refusals to start', () => {
  it('leaves to a person a file the trunk deleted while the branch changed it', () => {
    const root = trunkRepository({ [INVOICE]: 'class Invoice {\n}\n' });

    onBranch(root, 'build/billing');
    commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
    onBranch(root, 'main');
    commitFiles(root, { [INVOICE]: null }, 'refactor(billing): no invoice class (#2)');
    onBranch(root, 'build/billing');

    expect(mergeTrunk(root, '--json').json()).toMatchObject({
      forYou: [
        {
          file: INVOICE,
          why: 'the trunk deleted it, the other side changed it',
          hunks: [],
          ours: { change: 'see the file' },
          advice:
            'the trunk deleted it, the other side changed it: decide what the result holds, then `git add` or `git rm` it. Never take one side of the whole file.',
        },
      ],
    });
  });

  it('stops on a refusal of the drizzle replay, with its fix', () => {
    const root = trunkRepository({
      'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
      'schema/accounts.json': '{}',
    });

    const generate = (name: string): void => {
      expect(cli(root, 'drizzle-generate', '--name', name).code).toBe(0);
    };

    write(root, 'node_modules/drizzle-kit/bin.cjs', DRIZZLE_KIT_STUB);
    generate('initial');
    commitFiles(root, {}, 'chore: initial');
    onBranch(root, 'build/billing');
    write(root, 'schema/invoices.json', '{}');
    generate('working-add-invoices');
    write(root, 'schema/credit-notes.json', '{}');
    generate('working-add-credit-notes');
    commitFiles(root, {}, 'feat(billing): invoices');
    onBranch(root, 'main');
    write(root, 'schema/payments.json', '{}');
    generate('add-payments');
    commitFiles(root, {}, 'feat(payments): payments (#2)');
    onBranch(root, 'build/billing');

    const stopped = mergeTrunk(root);

    expect(stopped.code).toBe(1);

    expect(stopped.stdout).toContain(
      'stopped: the drizzle replay refused: 2 migrations of this branch change the schema',
    );

    expect(stopped.stdout).toContain('next: do what the migrations step says');
  }, 30_000);

  it('refuses to start during a cherry-pick, and forgets a state file without a merge', () => {
    const root = conflicting();

    try {
      git(root, 'cherry-pick', 'main');
    } catch {
      // The conflict leaves the cherry-pick in progress.
    }

    expect(mergeTrunk(root).stderr).toContain('a cherry-pick is in progress in this worktree.');
    git(root, 'cherry-pick', '--abort');
    write(root, '.ddd-ts-kit/merge.json', '{ "report": {} }');

    expect(goOn(root, '--continue').stderr).toContain('No merge of merge-trunk is in progress');
    expect(goOn(root, '--abort').code).toBe(2);
    expect(fs.existsSync(path.join(root, '.ddd-ts-kit/merge.json'))).toBe(false);
  });

  it('refuses to start where git knows no committer, before any change', () => {
    const root = conflicting();
    const saved = { ...process.env };

    const config = {
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'user.useConfigOnly',
      GIT_CONFIG_VALUE_0: 'true',
    };

    try {
      IDENTITY_VARIABLES.forEach((key) => {
        delete process.env[key];
      });

      Object.assign(process.env, config);

      const refused = mergeTrunk(root);

      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain('git does not know who commits in this repository');
    } finally {
      process.env = saved;
    }

    expect(merging(root)).toBe(false);
  });

  it('refuses a --since that is not a commit of the branch', () => {
    const root = conflicting();

    expect(mergeTrunk(root, '--since', 'main').stderr).toContain('--since main is not a commit of this branch.');
  });

  it('refuses to start when an untracked file stands where the trunk adds one, and changes nothing', () => {
    const root = conflicting();

    onBranch(root, 'main');
    commitFiles(root, { 'src/added.ts': 'export const added = 1;\n' }, 'feat: added (#3)');
    onBranch(root, 'build/billing');
    write(root, 'src/added.ts', 'mine\n');

    expect(mergeTrunk(root).stderr).toContain('The working tree is not clean: src/added.ts.');
  });
});
