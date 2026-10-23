import type { ResolvedImport } from '../model/resolved-import';
import type { SourceFile } from '../model/source-file';

/** The import of `file` that binds the local name `name`, if any. */
export function importedFrom(file: SourceFile, name: string): ResolvedImport | undefined {
  return file.imports.find(({ names }) => names.includes(name));
}
