import { spawnSync } from 'node:child_process';

/** The header of an object `cat-file --batch` found; anything else (`<name> missing`) has no content. */
const FOUND = /^[0-9a-f]{40,64} (\S+) (\d+)$/;

/**
 * The bytes of each blob `names` names (an object id, or `<tree>:<path>`), read in one
 * `git cat-file --batch`. A name that is missing or not a blob is left out.
 */
export function objectBytes(top: string, names: readonly string[]): Map<string, Buffer> {
  const wanted = [...new Set(names)].filter((name) => !name.includes('\n'));

  const output = spawnSync('git', ['cat-file', '--batch'], {
    cwd: top,
    input: wanted.map((name) => `${name}\n`).join(''),
    maxBuffer: 1 << 30,
  }).stdout;

  const contents = new Map<string, Buffer>();
  let at = 0;

  for (const name of wanted) {
    const end = output.indexOf(10, at);
    const found = end === -1 ? null : FOUND.exec(output.subarray(at, end).toString('utf8'));

    if (end === -1) {
      break;
    }

    at = end + 1;

    if (found !== null) {
      const size = Number(found[2]);

      if (found[1] === 'blob') {
        contents.set(name, output.subarray(at, at + size));
      }

      at += size + 1;
    }
  }

  return contents;
}
