import type { ResolvedImport } from '../model/resolved-import.js';
import type { SourceFile } from '../model/source-file.js';

/** The import of `file` that binds the local name `name`, if any. */
export function importedFrom(file: SourceFile, name: string): ResolvedImport | undefined {
  return file.imports.find(({ names }) => names.includes(name));
}
