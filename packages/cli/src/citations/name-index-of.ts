import type { Declaration } from './declaration.js';
import type { NameIndex } from './name-index.js';
import { namesOfFile } from './names-of-file.js';

/** The index of some files and of what they declare: each declared name, then the names their file names give. */
export function nameIndexOf(declarations: readonly Declaration[], files: readonly string[]): NameIndex {
  const names = new Map<string, string[]>();

  const add = (name: string, file: string): void => {
    const known = names.get(name) ?? [];

    names.set(name, known.includes(file) ? known : [...known, file]);
  };

  declarations.forEach(({ name, file }) => add(name, file));
  files.forEach((file) => namesOfFile(file).forEach((name) => add(name, file)));

  return { names, files: new Set(files) };
}
