import { createHash } from 'node:crypto';
import { scan } from '../check/scan/scan.js';
import type { StringRecord } from '../check/scan/string-record.js';
import { commentless } from './commentless.js';
import type { Scenario, ScenarioState } from './scenario.js';

/** An `it` or `test` call up to the quote of its title, read in the code, where comments and literals are blanked. */
const CALL = /\b(?:it|test)(?:\.(todo|skip|only|fails|failing|concurrent))?\(\s*['"`]/g;

/** `pending(` right after the title: the body waits for its code. */
const WRAPPER = /^\s*,\s*pending\s*\(/;

/** A row id as a title names it: `#US5.02`, `#M2.07`, `#4.15`. */
const ROW = /#([A-Za-z0-9][\w.-]*\w)/g;

/** An acceptance criterion of the story as a title names it: `AC1`. */
const CRITERION = /\bAC\d+\b/g;

const SKIPPED = new Set(['skip', 'fails', 'failing']);

/** The scenarios of an acceptance spec, in the order of the file. */
export function scenariosIn(source: string): Scenario[] {
  const scanned = scan(source);
  const { code } = scanned;
  const titles = new Map<number, StringRecord>(scanned.strings.map((record) => [record.start, record]));
  const written = commentless(source, scanned);

  return [...code.matchAll(CALL)].flatMap((match): Scenario[] => {
    const title = titles.get(match.index + match[0].length - 1);

    if (title === undefined) {
      return [];
    }

    const end = closingParenthesis(code, code.indexOf('(', match.index));
    const wrapper = WRAPPER.exec(code.slice(title.end, end));
    const opened = wrapper === null ? undefined : title.end + wrapper[0].length - 1;

    return [
      {
        title: title.value,
        line: scanned.lineAt(match.index),
        rows: [...title.value.matchAll(ROW)].flatMap(([, id]) => (id === undefined ? [] : [id])),
        criteria: [...new Set(title.value.match(CRITERION) ?? [])],
        state: stateOf(match[1], opened !== undefined),
        fingerprint: fingerprintOf(written, code, { start: match.index, end, opened, wrapperStart: title.end }),
      },
    ];
  });
}

function stateOf(modifier: string | undefined, isPending: boolean): ScenarioState {
  if (modifier === 'todo') {
    return 'todo';
  }

  if (modifier !== undefined && SKIPPED.has(modifier)) {
    return 'skipped';
  }

  return isPending ? 'pending' : 'active';
}

/** The offset just after the parenthesis that closes the one at `open`, or the end of the code. */
function closingParenthesis(code: string, open: number): number {
  let depth = 0;

  for (let at = open; at < code.length; at += 1) {
    depth += code[at] === '(' ? 1 : code[at] === ')' ? -1 : 0;

    if (depth === 0) {
      return at + 1;
    }
  }

  return code.length;
}

interface Extent {
  readonly start: number;
  readonly end: number;
  /** The offset of the parenthesis of `pending(`, when the body is wrapped. */
  readonly opened: number | undefined;
  /** Where the text after the title starts: the comma and `pending` are dropped from there. */
  readonly wrapperStart: number;
}

function fingerprintOf(written: string, code: string, extent: Extent): string {
  const { start, end, opened, wrapperStart } = extent;
  const closed = opened === undefined ? undefined : closingParenthesis(code, opened) - 1;

  const unwrapped =
    opened === undefined || closed === undefined
      ? written.slice(start, end)
      : `${written.slice(start, wrapperStart)},${written.slice(opened + 1, closed)}${written.slice(closed + 1, end)}`;

  const normalized = unwrapped.replace(/\s+/g, '').replace(/,(?=[)\]}])/g, '');

  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
