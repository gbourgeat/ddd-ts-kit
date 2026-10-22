import type { Exported } from '../exports/exported';
import { fileExports } from '../exports/file-exports';
import type { SourceFile } from '../model/source-file';
import { braceDepthAt } from '../text/brace-depth-at';
import { endAtDepthZero } from '../text/end-at-depth-zero';
import { localDeclaration } from './local-declaration';

const LOCAL_LIST = /(?<![\w$.])export\s*\{([^}]*)\}(?!\s*from\b)/g;

const DEFAULT_EXPRESSION =
  /(?<![\w$.])export\s+default\s+(?!(?:abstract\s+)?class\b|(?:async\s+)?function\b|interface\b)/g;

const IDENTIFIER = /^([A-Za-z_$][\w$]*)\s*(?:;|$)/;

/**
 * What a file exports, as `fileExports` reads it, with the values it leaves unread: a constant
 * exported by `export { money }` is read from its declaration, and `export default <expression>`
 * is read as a constant named `default` (`export default money` as what `money` declares).
 */
export function exportedValues(file: SourceFile): Exported[] {
  const { code } = file.scan;
  const known = fileExports(file).filter(({ kind, text }) => kind !== 'const' || text !== '');

  const listed = [...code.matchAll(LOCAL_LIST)].flatMap((match) =>
    (match[1] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '' && !part.startsWith('type '))
      .flatMap((part) => {
        const [local = '', alias] = part.split(/\s+as\s+/);
        const declared = localDeclaration(code, local);

        return declared?.kind === 'const'
          ? [{ ...declared, name: alias ?? local, line: file.scan.lineAt(match.index) }]
          : [];
      }),
  );

  return [...known, ...listed, ...defaultExpressions(file)];
}

function defaultExpressions(file: SourceFile): Exported[] {
  const { code } = file.scan;

  return [...code.matchAll(DEFAULT_EXPRESSION)]
    .filter(({ index }) => braceDepthAt(code, index) === 0)
    .flatMap(({ index, 0: keyword }): Exported[] => {
      const start = index + keyword.length;
      const named = IDENTIFIER.exec(code.slice(start));
      const line = file.scan.lineAt(index);
      const declared = named === null ? undefined : localDeclaration(code, named[1] ?? '');

      if (named !== null) {
        // A class keeps its own name, as `export { Money }` gives it: the value object files read classes by name.
        return declared === undefined
          ? []
          : [{ ...declared, name: declared.kind === 'class' ? declared.name : 'default', line }];
      }

      const text = `default = ${code.slice(start, endAtDepthZero(code, start, ';'))}`;

      return [{ name: 'default', kind: 'const', line, text, signature: text }];
    });
}
