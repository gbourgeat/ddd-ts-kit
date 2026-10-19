import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import { codeWithoutImports } from './code-without-imports.js';
import type { NamedMove } from './named-move.js';
import { replaceInCode, type CodeMatch } from './replace-in-code.js';

/**
 * The import of a concept class becomes the imports of the classes of their own the file reads,
 * from the files next to it, in the form it was written (alias or relative path, extension). It
 * stays when the file still names the concept class.
 */
export function conceptImports(source: string, concept: string, moves: readonly NamedMove[]): string {
  const pattern = new RegExp(`import\\s+(type\\s+)?\\{\\s*${escapeRegExp(concept)}\\s*\\}\\s*from\\s*`, 'g');
  const code = codeWithoutImports(source);
  const reads = (name: string): boolean => new RegExp(`(?<![\\w$.])${escapeRegExp(name)}(?![\\w$])`).test(code);
  const imported = (name: string): boolean => new RegExp(`^import [^;]*\\{[^}]*\\b${name}\\b`, 'm').test(source);
  const classes = [...new Map(moves.map((move) => [move.className, move])).values()];
  const needed = classes.filter((move) => reads(move.className) && !imported(move.className));

  return replaceInCode(source, pattern, (found) => replaced(found, { kept: reads(concept), needed }));
}

interface Replacement {
  /** The file still names the concept class. */
  readonly kept: boolean;
  readonly needed: readonly NamedMove[];
}

function replaced(found: CodeMatch, { kept, needed }: Replacement): { text: string; end: number } | undefined {
  const { match, scanned } = found;
  const start = match.index + match[0].length;
  const specifier = scanned.strings.find((literal) => literal.start === start);

  if (specifier === undefined) {
    return undefined;
  }

  const semicolon = scanned.code.charAt(specifier.end) === ';' ? specifier.end + 1 : specifier.end;

  const lines = needed.map(
    (move) =>
      `import ${match[1] ?? ''}{ ${move.className} } from '${specifier.value.replace(/[^/]+?\.error((?:\.js)?)$/, `${move.classFile}$1`)}';`,
  );

  const all = kept ? [found.slice(match.index, semicolon), ...lines] : lines;

  // An import nothing replaces goes with its line.
  return all.length === 0
    ? { text: '', end: scanned.code.charAt(semicolon) === '\n' ? semicolon + 1 : semicolon }
    : { text: all.join('\n'), end: semicolon };
}
