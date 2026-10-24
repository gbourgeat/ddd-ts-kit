import { scan } from '../check/scan/scan';

/** What one `it` of a spec states: its title, where, and whether it is written, planned (`it.todo`) or put aside (`.skip`, `.fails`). */
export interface StatedRule {
  readonly title: string;
  readonly line: number;
  readonly state: 'stated' | 'planned' | 'aside';
}

/** A `describe` of a spec: its title, the rules directly under it and the groups it nests. */
export interface RuleGroup {
  readonly title: string;
  readonly line: number;
  readonly rules: StatedRule[];
  readonly groups: RuleGroup[];
}

/** The rules a spec states, as its `describe` and `it` titles lay them out. */
export interface SpecRules {
  readonly rules: StatedRule[];
  readonly groups: RuleGroup[];
}

interface Found {
  readonly kind: 'group' | 'rule';
  readonly title: string;
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly state: StatedRule['state'];
}

/** A `describe`, `it` or `test` call, with a modifier (`it.todo`) or a table (`it.each(..)`), up to its opening parenthesis. */
const CALL = /\b(describe|it|test)(?:\.(todo|skip|only|fails|failing|concurrent|each))?\(/g;
/** The quote of a title right after an opening parenthesis. */
const TITLE = /^\s*['"`]/;
const ASIDE = new Set(['skip', 'only', 'fails', 'failing']);

/**
 * Reads the rules of a spec from its titles, without running it: the `it` and `test` calls whose
 * title is a literal, grouped under the `describe` calls that hold them, in the order of the file.
 * A call whose title is not a literal is left out, and what it holds counts under its parent.
 */
export function rulesIn(source: string): SpecRules {
  const scanned = scan(source);
  const titles = new Map(scanned.strings.map((record) => [record.start, record.value]));

  return nested(
    [...scanned.code.matchAll(CALL)].flatMap((match) => {
      const item = foundIn(scanned.code, titles, match);

      return item === undefined ? [] : [{ ...item, line: scanned.lineAt(match.index) }];
    }),
  );
}

/** The call a match starts, when its title is a literal: a table (`it.each(..)`) is skipped to the call that follows it. */
function foundIn(
  code: string,
  titles: ReadonlyMap<number, string>,
  match: RegExpExecArray,
): Omit<Found, 'line'> | undefined {
  const [, kind = '', modifier] = match;
  const afterCall = match.index + match[0].length - 1;
  const open = modifier === 'each' ? callAfter(code, closingParenthesis(code, afterCall)) : afterCall;

  if (open === undefined) {
    return undefined;
  }

  const quote = TITLE.exec(code.slice(open + 1));
  const title = quote === null ? undefined : titles.get(open + quote[0].length);

  if (title === undefined) {
    return undefined;
  }

  return {
    kind: kind === 'describe' ? 'group' : 'rule',
    title,
    start: match.index,
    end: closingParenthesis(code, open),
    state: stateOf(modifier),
  };
}

function stateOf(modifier: string | undefined): StatedRule['state'] {
  if (modifier === 'todo') {
    return 'planned';
  }

  return modifier !== undefined && ASIDE.has(modifier) ? 'aside' : 'stated';
}

/** The groups and rules as a tree: each one belongs to the innermost `describe` whose call holds it. */
function nested(found: readonly Found[]): SpecRules {
  const root: SpecRules = { rules: [], groups: [] };
  const open: { group: RuleGroup; end: number }[] = [];

  for (const item of found) {
    while (open.length > 0 && (open[open.length - 1]?.end ?? 0) <= item.start) {
      open.pop();
    }

    const parent = open[open.length - 1]?.group ?? root;

    if (item.kind === 'group') {
      const group: RuleGroup = { title: item.title, line: item.line, rules: [], groups: [] };

      parent.groups.push(group);
      open.push({ group, end: item.end });
    } else {
      parent.rules.push({ title: item.title, line: item.line, state: item.state });
    }
  }

  return root;
}

/** The offset of the parenthesis that opens the call right after `at`, white space allowed, or nothing. */
function callAfter(code: string, at: number): number | undefined {
  const next = /^\s*\(/.exec(code.slice(at));

  return next === null ? undefined : at + next[0].length - 1;
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
