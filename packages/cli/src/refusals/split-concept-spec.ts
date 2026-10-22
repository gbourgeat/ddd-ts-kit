import { scan, type Scan } from '../check/scan/scan';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import { matchingBracket } from '../check/text/matching-bracket';
import type { NamedMove } from './named-move';

const DESCRIBE = /(?<![\w$.])describe\s*\(/;
const IMPORT = /^import [^;]+;\n/gm;
const CASE = /^\s*(?:it|test|describe)\b/;

/** The spec of a concept class cut by refusal: the cases each class of its own takes, and the ones that stay. */
export interface SplitSpec {
  readonly imports: readonly string[];
  /** Per class of its own, its cases as written, indented as members of a `describe`. */
  readonly cases: ReadonlyMap<string, readonly string[]>;
  /** The spec with the cases that stay, or undefined when none does. */
  readonly rest: string | undefined;
  /** The classes of their own whose cases stay because they take none. */
  readonly left: readonly string[];
}

/**
 * Cuts the spec of a concept class: each case of its `describe` that builds the refusals of one
 * class of its own only goes to that class, when that class takes cases. Undefined when the spec
 * is not one `describe` of cases (a setup the cases share, code around it): it is then rewritten
 * in place, and moved by hand.
 */
export function splitConceptSpec(
  source: string,
  moves: readonly NamedMove[],
  takes: (className: string) => boolean = () => true,
): SplitSpec | undefined {
  const scanned = scan(source);
  const described = DESCRIBE.exec(scanned.code);
  const open = described === null ? -1 : scanned.code.indexOf('{', described.index);
  const statements = open === -1 ? undefined : statementsOf(scanned, source, open);

  if (described === null || statements === undefined || !alone(scanned, described.index)) {
    return undefined;
  }

  const cases = new Map<string, string[]>();
  const left = new Set<string>();

  const staying = statements.filter((statement) => {
    const owner = ownerOf(scan(statement).code, moves);

    if (owner !== undefined && takes(owner)) {
      cases.set(owner, [...(cases.get(owner) ?? []), statement]);

      return false;
    }

    if (owner !== undefined) {
      left.add(owner);
    }

    return true;
  });

  const close = matchingBracket(scanned.code, open);
  const rest = `${source.slice(0, open + 1)}\n${staying.join('\n\n')}\n${source.slice(close)}`;

  return {
    imports: source.match(IMPORT) ?? [],
    cases,
    rest: staying.length === 0 ? undefined : rest,
    left: [...left],
  };
}

/** The statements of the block opened at `open`, each one a case: undefined when one is not. */
function statementsOf(scanned: Scan, source: string, open: number): string[] | undefined {
  const close = matchingBracket(scanned.code, open);
  const statements: string[] = [];
  let start = open + 1;
  let depth = 0;

  for (let at = open + 1; at < close; at += 1) {
    const char = scanned.code.charAt(at);

    depth += '([{'.includes(char) ? 1 : ')]}'.includes(char) ? -1 : 0;

    if (char === ';' && depth === 0) {
      statements.push(source.slice(start, at + 1).replace(/^\s*\n/, ''));
      start = at + 1;
    }
  }

  const complete = scanned.code.slice(start, close).trim() === '';

  return complete && statements.every((statement) => CASE.test(scan(statement).code)) ? statements : undefined;
}

/** Nothing but imports and the `describe` that starts at `at`. */
function alone(scanned: Scan, at: number): boolean {
  const open = scanned.code.indexOf('(', at);
  const end = matchingBracket(scanned.code, open);
  const around = scanned.code.slice(0, at) + scanned.code.slice(end + 1).replace(/^\s*;/, '');

  return around.replace(IMPORT, '').trim() === '';
}

/** The class of its own whose factories a case builds, when it builds the refusals of one only. */
function ownerOf(code: string, moves: readonly NamedMove[]): string | undefined {
  const owners = new Set(
    moves
      .filter((move) =>
        new RegExp(
          `(?<![\\w$.])${escapeRegExp(move.oldClass)}\\s*\\.\\s*${escapeRegExp(move.oldFactory ?? '')}(?![\\w$])`,
        ).test(code),
      )
      .map((move) => move.className),
  );

  return owners.size === 1 ? [...owners][0] : undefined;
}
