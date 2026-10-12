import type { Scan } from '../../check/scan/scan.js';
import { escapeRegExp } from '../../check/text/escape-reg-exp.js';
import { matchingBracket } from '../../check/text/matching-bracket.js';

/** Where the body of a class opens and closes in its source, braces included. */
export interface ClassBody {
  readonly open: number;
  readonly close: number;
}

export function classBody(scan: Scan, className: string): ClassBody | undefined {
  const declared = new RegExp(`(?<![\\w$.])class\\s+${escapeRegExp(className)}(?![\\w$])`).exec(scan.code);

  if (declared === null) {
    return undefined;
  }

  const open = scan.code.indexOf('{', declared.index);

  return open === -1 ? undefined : { open, close: matchingBracket(scan.code, open) };
}
