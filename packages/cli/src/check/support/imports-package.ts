import type { SourceFile } from '../model/source-file.js';

/** True when the file imports something from `packageName`, by its main entry or by any other. */
export function importsPackage(file: SourceFile, packageName: string): boolean {
  return file.imports.some(({ target }) => target.kind === 'package' && target.name === packageName);
}
