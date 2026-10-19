import { movedSpecifier, type Relocation } from './moved-specifier.js';

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.mock\s*\(\s*)(['"])([^'"\n]+)\2/g;

/** The source of `file` with every import of a moved file naming it where it is now. */
export function withMovedImports(source: string, file: string, relocation: Relocation): string {
  return source.replace(SPECIFIER, (whole: string, ...groups: string[]) => {
    const [before = '', quote = '', specifier = ''] = groups;
    const moved = movedSpecifier(specifier, file, relocation);

    return moved === undefined ? whole : `${before}${quote}${moved}${quote}`;
  });
}
