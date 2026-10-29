import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Directories never copied when the project is not a git repository. */
const NOT_COPIED = new Set(['node_modules', '.git', 'dist', 'coverage', '.worktrees']);

/** A copy of the project, its sources only, in a directory of its own that the caller removes. */
export function copyOfProject(root: string): string {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-plan-'));

  for (const file of sourceFiles(root)) {
    fs.mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(copy, file));
  }

  return copy;
}

/** The files git sees, tracked or not, the ignored ones left out; every file outside the build folders when git does not answer. */
function sourceFiles(root: string): string[] {
  const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });

  if (listed.status === 0) {
    return listed.stdout
      .split('\0')
      .filter((file) => file !== '' && fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile());
  }

  return walk(root, '');
}

function walk(root: string, directory: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return NOT_COPIED.has(entry.name) ? [] : walk(root, relative);
    }

    return entry.isFile() ? [relative] : [];
  });
}
