import fs from 'node:fs';
import path from 'node:path';
import type { Io } from '../commands/io';
import { stdoutJson } from '../json/stdout-json';
import { withToolOutputOnStderr } from './tool-stdio';

export interface JsonGeneration {
  readonly root: string;
  /** The folders, from the root, where the tool writes; read before and after the run. */
  readonly folders: readonly string[];
}

/**
 * Runs a `*-generate` command with what it prints held back and the output of the tool of the ORM
 * sent to stderr, then answers `{ code, written, messages }` on one line: the exit code, the files
 * of the folders that are new or changed, and the lines the command said.
 */
export function answeredAsJson(generation: JsonGeneration, io: Io, run: (held: Io) => number): number {
  const messages: string[] = [];
  const held: Io = { out: (text) => void messages.push(text), err: (text) => void messages.push(text) };
  const before = filesUnder(generation);
  const code = withToolOutputOnStderr(() => run(held));
  const after = filesUnder(generation);
  const written = [...after].filter(([file, content]) => before.get(file) !== content).map(([file]) => file);

  io.out(stdoutJson({ code, written, messages }));

  return code;
}

/** Every file under the folders, by path from the root (POSIX separators), with its content; a folder out of the project is left out. */
function filesUnder({ root, folders }: JsonGeneration): Map<string, string> {
  const files = new Map<string, string>();

  for (const folder of folders) {
    const relative = path.posix.normalize(folder);
    const directory = path.join(root, relative);

    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(directory)) {
      continue;
    }

    for (const entry of fs.readdirSync(directory, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) {
        const file = path.join(entry.parentPath, entry.name);

        files.set(path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8'));
      }
    }
  }

  return files;
}
