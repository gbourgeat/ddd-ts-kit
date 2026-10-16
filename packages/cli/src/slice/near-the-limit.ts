import fs from 'node:fs';
import path from 'node:path';
import type { SizedFile } from './sized-file.js';

/** The limit of clean/file-size, and where adding to a file starts with an extraction. */
const LIMIT = 350;
const NEAR = 300;

/**
 * The changed files close to the size limit, longest first: the next change to them should
 * begin by moving a concept out, before the limit forces it in a hurry.
 */
export function nearTheLimit(root: string, changed: Iterable<string>): SizedFile[] {
  return [...changed]
    .filter((file) => /\.[cm]?tsx?$/.test(file) && !file.endsWith('.d.ts'))
    .map((file) => ({ file, lines: linesOf(path.join(root, file)) }))
    .filter(({ lines }) => lines > NEAR && lines <= LIMIT)
    .sort((one, other) => other.lines - one.lines);
}

function linesOf(file: string): number {
  if (!fs.existsSync(file)) {
    return 0;
  }

  const text = fs.readFileSync(file, 'utf8');

  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}
