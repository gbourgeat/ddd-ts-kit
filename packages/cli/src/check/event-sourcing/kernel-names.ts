import type { SourceFile } from '../model/source-file';

export interface NamedImport {
  readonly name: string;
  readonly line: number;
}

/** The names a file imports from `@ddd-ts-kit/kernel`, any entry, among `wanted`. */
export function kernelNames(file: SourceFile, wanted: ReadonlySet<string>): NamedImport[] {
  return file.imports.flatMap(({ target, names, line }) =>
    target.kind === 'package' && target.name.startsWith('@ddd-ts-kit/kernel')
      ? names.filter((name) => wanted.has(name)).map((name) => ({ name, line }))
      : [],
  );
}
