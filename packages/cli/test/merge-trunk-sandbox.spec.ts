import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isSandboxMask } from '../src/merge/is-sandbox-mask';
import { write } from './helpers';
import { git } from './support/git';
import { commitFiles, mergeTrunk, merging, onBranch, trunkRepository } from './support/trunk-history';

const SETTINGS = '.claude/settings.json';
const OTHER = 'src/other.ts';

/** A branch that diverged from a main which changes `changed`. */
function diverged(changed: Record<string, string>): string {
  const root = trunkRepository({ [SETTINGS]: '{}\n', 'openapi/openapi.yaml': 'a\n', [OTHER]: 'x\n' });

  onBranch(root, 'build/billing');
  commitFiles(root, { 'src/own.ts': 'own\n' }, 'feat(billing): own');
  onBranch(root, 'main');
  commitFiles(root, changed, 'feat: trunk (#2)');
  onBranch(root, 'build/billing');

  return root;
}

const root = process.getuid?.() === 0;

describe('merge-trunk: a path the session cannot write', () => {
  it.skipIf(root)('stops with nothing changed and exit 3 when the trunk changes a read-only file', () => {
    const repo = diverged({ [SETTINGS]: '{"new":1}\n', [OTHER]: 'y\n' });
    const file = path.join(repo, SETTINGS);

    fs.chmodSync(path.dirname(file), 0o555);

    try {
      const result = mergeTrunk(repo);

      expect(result.code).toBe(3);
      expect(result.stderr).toContain(SETTINGS);
      expect(result.stderr).toContain('outside the sandbox');
      expect(merging(repo)).toBe(false);
      expect(git(repo, 'status', '--porcelain').trim()).toBe('');
      expect(fs.readFileSync(path.join(repo, OTHER), 'utf8')).toBe('x\n');
    } finally {
      fs.chmodSync(path.dirname(file), 0o755);
    }
  });

  it.skipIf(root)('stops for a path the trunk adds in a read-only folder', () => {
    const repo = diverged({ 'openapi/new.yaml': 'n\n' });

    fs.chmodSync(path.join(repo, 'openapi'), 0o555);

    try {
      const result = mergeTrunk(repo);

      expect(result.code).toBe(3);
      expect(result.stderr).toContain('openapi/new.yaml');
    } finally {
      fs.chmodSync(path.join(repo, 'openapi'), 0o755);
    }
  });

  it('merges when every path the trunk changes can be written', () => {
    const repo = diverged({ [SETTINGS]: '{"new":1}\n' });

    expect(mergeTrunk(repo).code).toBe(0);
  });
});

describe('merge-trunk: the masks of a sandbox', () => {
  it('classifies a character device, and nothing else, as a mask', () => {
    const device = fs.statSync('/dev/null');
    const file = fs.statSync(__filename);

    expect(isSandboxMask(device)).toBe(true);
    expect(isSandboxMask(file)).toBe(false);
  });

  it('still refuses a real untracked file (the device itself needs root to create)', () => {
    const repo = diverged({ [OTHER]: 'y\n' });

    // Root alone can create a device node: a symlink to /dev/null is lstat-ed as a link, so only the stat is proved above.
    write(repo, 'stray.txt', 'work\n');

    const result = mergeTrunk(repo);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('The working tree is not clean: stray.txt');
  });
});
