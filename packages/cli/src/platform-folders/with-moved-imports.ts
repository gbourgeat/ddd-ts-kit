import { movedSpecifier, type Relocation } from './moved-specifier.js';

const SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.mock\s*\(\s*|\bnew URL\(\s*)(['"])([^'"\n]+)\2/g;

/**
 * The source of `file` with every import of a moved file naming it where it is now, and every
 * `new URL(<relative>, import.meta.url)` of a moved file reaching what it reached before.
 */
export function withMovedImports(source: string, file: string, relocation: Relocation): string {
  return source.replace(SPECIFIER, (whole: string, ...groups: string[]) => {
    const [before = '', quote = '', specifier = ''] = groups;
    const moved = movedSpecifier(specifier, file, relocation);

    return moved === undefined ? whole : `${before}${quote}${moved}${quote}`;
  });
}
