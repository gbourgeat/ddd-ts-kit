import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir, walk, write } from './helpers';
import { git } from './support/git';
import { copyOfProject } from '../src/plan/copy-of-project';

/** A project with one source and a link to a key outside it, the link tracked by git when `tracked`. */
function projectLinkingOut(tracked: boolean): string {
  const root = tempDir('plan-copy');
  const outside = tempDir('plan-copy-home');

  write(outside, 'id_rsa', 'PRIVATE KEY\n');
  write(root, 'src/main.ts', 'export {};\n');
  fs.symlinkSync(path.join(outside, 'id_rsa'), path.join(root, 'id_rsa'));

  if (tracked) {
    git(root, 'init', '--quiet');
    git(root, 'add', '.');
  }

  return root;
}

/** The files of the copy plan-waves replays its commands in, the copy removed. */
function copiedFiles(root: string): string[] {
  const copy = copyOfProject(root);

  try {
    return walk(copy);
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

describe.skipIf(process.platform === 'win32')('the copy of the project plan-waves replays in', () => {
  it('leaves out a tracked symbolic link to a file outside the project, so that it never holds what the link points at', () => {
    const root = projectLinkingOut(true);

    expect(git(root, 'ls-files')).toContain('id_rsa');
    expect(copiedFiles(root)).toEqual(['src/main.ts']);
  });

  it('leaves it out of a project git does not hold too', () => {
    expect(copiedFiles(projectLinkingOut(false))).toEqual(['src/main.ts']);
  });
});
