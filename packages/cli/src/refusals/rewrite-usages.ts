import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import type { Move } from './move.js';
import { replaceInCode, type CodeMatch } from './replace-in-code.js';

const NOT_IN_A_NAME = '(?<![\\w$.])';

type Pass = (source: string, move: Move, name: string) => string;

/** Told when a class per error stood as a value where nothing above knew what to write: the concept class stands there now. */
export type OnValue = (className: string, conceptClass: string) => void;

/** A file where no class per error is named any more: constructions, assertions, imports and types follow the moves. */
export function rewriteUsages(source: string, moves: readonly Move[], onValue: OnValue = () => undefined): string {
  const named = moves.filter((move) => source.includes(move.className));

  const rewritten = named.reduce((text, move) => {
    const name = escapeRegExp(move.className);

    const known = (move.ownClass === true ? OWN_CLASS_PASSES : PASSES).reduce(
      (current, pass) => pass(current, move, name),
      text,
    );

    return renamed(known, move, onValue);
  }, source);

  return named.length === 0 ? source : tidyImports(rewritten, new Set(named.map((move) => move.conceptClass)));
}

const CONSTRUCTION: Pass = (source, move, name) =>
  replaceInCode(source, new RegExp(`${NOT_IN_A_NAME}new\\s+${name}\\s*\\(`, 'g'), () => ({
    text: `${move.conceptClass}.${move.factory}(`,
  }));

const IMPORT: Pass = (source, move, name) =>
  replaceInCode(source, new RegExp(`import\\s+(type\\s+)?\\{\\s*${name}\\s*\\}\\s*from\\s*`, 'g'), (found) =>
    importOf(found, move),
  );

/** A class of its own stands where the class per error stood, in an assertion as anywhere else: only what builds it changes. */
const OWN_CLASS_PASSES: readonly Pass[] = [CONSTRUCTION, IMPORT];

const PASSES: readonly Pass[] = [
  CONSTRUCTION,
  (source, move, name) =>
    replaceInCode(source, new RegExp(`\\.thenError\\(\\s*${name}\\s*(?:,[^()]*)?\\)`, 'g'), () => ({
      text: `.thenError('${move.code}')`,
    })),
  (source, move, name) =>
    replaceInCode(source, new RegExp(`\\.toThrow(?:Error)?\\(\\s*${name}\\s*,?\\s*\\)`, 'g'), () => ({
      text: `.toThrow(expect.objectContaining({ code: '${move.code}' }))`,
    })),
  (source, move, name) =>
    replaceInCode(source, new RegExp(`(?<![\\w$])expect\\.any\\(\\s*${name}\\s*,?\\s*\\)`, 'g'), () => ({
      text: `expect.objectContaining({ code: '${move.code}' })`,
    })),
  (source, move, name) =>
    replaceInCode(source, new RegExp(`\\.toBeInstanceOf\\(\\s*${name}\\s*,?\\s*\\)`, 'g'), () => ({
      text: `.toMatchObject({ code: '${move.code}' })`,
    })),
  (source, move, name) =>
    replaceInCode(source, new RegExp(`([A-Za-z_$][\\w$.]*)\\s+instanceof\\s+${name}(?![\\w$])`, 'g'), ({ match }) => ({
      text: `${move.conceptClass}.is(${match[1] ?? ''}, '${move.code}')`,
    })),
  IMPORT,
];

/** What is left names a type, and takes the name of the concept class; a value left there asserts less than it did, and is told. */
function renamed(source: string, move: Move, onValue: OnValue): string {
  const pattern = new RegExp(`${NOT_IN_A_NAME}${escapeRegExp(move.className)}(?![\\w$])`, 'g');

  return replaceInCode(source, pattern, ({ match, scanned }) => {
    const before = scanned.code.slice(0, match.index).trimEnd().at(-1) ?? '';

    const after = scanned.code
      .slice(match.index + match[0].length)
      .trimStart()
      .charAt(0);

    if (move.ownClass !== true && !':<|&'.includes(before) && !(before === ',' && '>|&'.includes(after))) {
      onValue(move.className, move.conceptClass);
    }

    return { text: move.conceptClass };
  });
}

/** The import of the class becomes the import of its concept class, from the file next to it. */
function importOf({ match, scanned }: CodeMatch, move: Move): { text: string; end: number } | undefined {
  const start = match.index + match[0].length;
  const specifier = scanned.strings.find((literal) => literal.start === start);

  if (specifier === undefined) {
    return undefined;
  }

  const target = specifier.value.replace(/[^/]+?\.error((?:\.js)?)$/, `${move.conceptFile}$1`);
  const end = scanned.code.charAt(specifier.end) === ';' ? specifier.end + 1 : specifier.end;

  return { text: `import ${match[1] ?? ''}{ ${move.conceptClass} } from '${target}';`, end };
}

/** Several classes moved to one: its import is written once, a union names it once, and an import nothing reads goes. */
function tidyImports(source: string, concepts: ReadonlySet<string>): string {
  let text = source;

  for (const concept of concepts) {
    const name = escapeRegExp(concept);
    const imported = new RegExp(`^import (type )?\\{ ${name} \\} from '[^']+';\\n`, 'gm');
    const lines = [...text.matchAll(imported)];
    const kept = lines.find((line) => line[1] === undefined) ?? lines[0];
    const used = text.replace(imported, '').match(new RegExp(`${NOT_IN_A_NAME}${name}(?![\\w$])`, 'g')) !== null;

    let written = false;

    text = text.replace(imported, (line) => {
      const keep = used && !written && line === kept?.[0];

      written ||= keep;

      return keep ? line : '';
    });

    text = text.replace(new RegExp(`\\b${name}(?:\\s*\\|\\s*${name}\\b)+`, 'g'), concept);
  }

  return text;
}
