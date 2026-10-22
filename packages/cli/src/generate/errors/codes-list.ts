import { scan } from '../../check/scan/scan';
import { escapeRegExp } from '../../check/text/escape-reg-exp';
import { matchingBracket } from '../../check/text/matching-bracket';

const ENTRY_KEY = /([A-Za-z_$][\w$]*)\s*:\s*(?=['"])/g;

/** The object literal of the closed list of codes in `domain/errors/codes.ts`: its braces, and its entries in order. */
export interface CodesList {
  readonly open: number;
  readonly close: number;
  /** Class name to code, as the file writes them. */
  readonly entries: ReadonlyMap<string, string>;
}

/** The list named `listName` in the source of a `codes.ts`; undefined when the source does not declare it. */
export function codesList(source: string, listName: string): CodesList | undefined {
  const scanned = scan(source);
  const declared = new RegExp(`\\bconst\\s+${escapeRegExp(listName)}\\s*(?::[^=]+)?=\\s*\\{`).exec(scanned.code);

  if (declared === null) {
    return undefined;
  }

  const open = declared.index + declared[0].length - 1;
  const close = matchingBracket(scanned.code, open);
  const body = scanned.code.slice(open + 1, close);
  const entries = new Map<string, string>();

  for (const match of body.matchAll(ENTRY_KEY)) {
    const start = open + 1 + match.index + match[0].length;
    const value = scanned.strings.find((literal) => literal.start === start)?.value;

    if (match[1] !== undefined && value !== undefined) {
      entries.set(match[1], value);
    }
  }

  return { open, close, entries };
}
