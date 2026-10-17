import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** The revision that stands for the index plus the working tree: the result of a merge in progress. */
export const WORKTREE = ':worktree';

/** The header of an object `cat-file --batch` found; anything else (`<name> missing`) has no content. */
const FOUND = /^[0-9a-f]{40,64} (\S+) (\d+)$/;

/**
 * The text of each of `paths` at `revision`, by path from the top of the repository, read in one
 * `git cat-file --batch`, or from the working tree for {@link WORKTREE}. A path the revision does
 * not hold, a directory and a binary file (a NUL byte) are left out.
 */
export function revisionFiles(top: string, revision: string, paths: readonly string[]): Map<string, string> {
  const contents = revision === WORKTREE ? fromWorktree(top, paths) : fromGit(top, revision, paths);

  return new Map(
    [...contents]
      .filter(([, content]) => !content.includes(0))
      .map(([file, content]) => [file, content.toString('utf8')]),
  );
}

function fromWorktree(top: string, paths: readonly string[]): Map<string, Buffer> {
  return new Map(
    paths.flatMap((file) => {
      const content = readIfFile(path.join(top, file));

      return content === undefined ? [] : [[file, content] as const];
    }),
  );
}

/** The bytes of a file, read once: a missing path or a directory has none. */
function readIfFile(absolute: string): Buffer | undefined {
  try {
    return fs.readFileSync(absolute);
  } catch {
    return undefined;
  }
}

/** Each answer of `cat-file --batch` is `<sha> <type> <size>\n<content>\n`, or `<name> missing\n`. */
function fromGit(top: string, revision: string, paths: readonly string[]): Map<string, Buffer> {
  const wanted = paths.filter((file) => !file.includes('\n'));
  const input = wanted.map((file) => `${revision}:${file}\n`).join('');
  const output = spawnSync('git', ['cat-file', '--batch'], { cwd: top, input, maxBuffer: 1 << 30 }).stdout;
  const contents = new Map<string, Buffer>();
  let at = 0;

  for (const file of wanted) {
    const end = output.indexOf(10, at);

    if (end === -1) {
      break;
    }

    const found = FOUND.exec(output.subarray(at, end).toString('utf8'));

    at = end + 1;

    if (found !== null) {
      const size = Number(found[2]);

      if (found[1] === 'blob') {
        contents.set(file, output.subarray(at, at + size));
      }

      at += size + 1;
    }
  }

  return contents;
}
