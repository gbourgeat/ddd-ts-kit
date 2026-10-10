import type { SourceFile } from '../model/source-file.js';

const EXPORTED_CLASS = /(?<![\w$.])export\s+(?:default\s+)?class\s+([\w$]+)/;

export interface NamedClass {
  readonly name: string;
  readonly line: number;
}

/** The first concrete class a file exports. */
export function exportedClass(file: SourceFile): NamedClass | undefined {
  const match = EXPORTED_CLASS.exec(file.scan.code);
  const name = match?.[1];

  return match === null || name === undefined ? undefined : { name, line: file.scan.lineAt(match.index) };
}
