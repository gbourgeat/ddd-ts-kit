import type { AppliedMoves } from './applied-moves.js';
import { wholeLiteral } from '../check/declarations/whole-literal.js';
import { callArguments } from '../check/text/call-arguments.js';
import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { conceptImports } from './concept-imports.js';
import { conceptLeftovers, type OnLeft } from './concept-leftovers.js';
import type { NamedMove } from './named-move.js';
import { replaceInCode, type CodeMatch } from './replace-in-code.js';

type Pass = (source: string, concept: string, moves: readonly NamedMove[]) => string;

/**
 * A file where the factories of concept classes are no longer named: each call becomes the call
 * of the factory of the class of its own, `AppointmentError.is(error, 'CODE')` becomes
 * `<Class>.is(error)`, `RefusalOf<typeof AppointmentError, 'CODE'>` names the class, and the import
 * of the concept class becomes the imports of the classes the file reads. What still names a
 * concept class that is `gone` is told, with its line: no rewrite says what it meant.
 */
export function rewriteConceptUsages(
  source: string,
  { moves, gone }: AppliedMoves,
  onLeft: OnLeft = () => undefined,
): string {
  const concepts = [...new Set(moves.map((move) => move.oldClass))].filter((concept) => source.includes(concept));

  return concepts.reduce((text, concept) => {
    const own = moves.filter((move) => move.oldClass === concept);
    const rewritten = PASSES.reduce((current, pass) => pass(current, concept, own), text);
    const imported = conceptImports(rewritten, concept, own);

    if (gone.has(concept)) {
      conceptLeftovers(imported, concept, onLeft);
    }

    return imported;
  }, source);
}

const PASSES: readonly Pass[] = [
  (source, concept, moves) =>
    replaceInCode(source, new RegExp(`(?<![\\w$.])${escapeRegExp(concept)}\\s*\\.\\s*is\\s*\\(`, 'g'), (found) =>
      narrowed(found, moves),
    ),
  (source, concept, moves) =>
    replaceInCode(
      source,
      new RegExp(`(?<![\\w$.])${escapeRegExp(concept)}\\s*\\.\\s*([A-Za-z_$][\\w$]*)(?![\\w$])`, 'g'),
      ({ match }) => {
        const move = moves.find((candidate) => candidate.oldFactory === match[1]);

        return move === undefined ? undefined : { text: `${move.className}.${move.factory}` };
      },
    ),
  (source, concept, moves) =>
    replaceInCode(source, new RegExp(`RefusalOf\\s*<\\s*typeof\\s+${escapeRegExp(concept)}\\s*,\\s*`, 'g'), (found) =>
      refusalOf(found, moves),
    ),
];

/** `AppointmentError.is(error, 'APPOINTMENT_ENDED')` becomes `AppointmentEnded.is(error)`: the class says the code. */
function narrowed(found: CodeMatch, moves: readonly NamedMove[]): { text: string; end: number } | undefined {
  const { match, scanned } = found;
  const open = match.index + match[0].length - 1;
  const [error, code, ...rest] = callArguments(scanned.code, open);
  const literal = code === undefined ? undefined : wholeLiteral(scanned, code);
  const move = moves.find((candidate) => candidate.code === literal);

  if (error === undefined || move === undefined || rest.length > 0) {
    return undefined;
  }

  return {
    text: `${move.className}.is(${found.slice(error.start, error.start + error.code.length)})`,
    end: matchingBracket(scanned.code, open) + 1,
  };
}

/** `RefusalOf<typeof AppointmentError, 'APPOINTMENT_ENDED'>` becomes `RefusalOf<typeof AppointmentEnded>`. */
function refusalOf(
  { match, scanned }: CodeMatch,
  moves: readonly NamedMove[],
): { text: string; end: number } | undefined {
  const at = match.index + match[0].length;
  const literal = scanned.strings.find((candidate) => candidate.start === at);
  const move = moves.find((candidate) => candidate.code === literal?.value);
  const closing = literal === undefined ? -1 : scanned.code.slice(literal.end).search(/\S/);

  if (literal === undefined || move === undefined || scanned.code.charAt(literal.end + closing) !== '>') {
    return undefined;
  }

  return { text: `RefusalOf<typeof ${move.className}>`, end: literal.end + closing + 1 };
}
