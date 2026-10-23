import { matchingBracket } from '../check/text/matching-bracket';
import { refusalCode } from './refusal-code';

const BEFORE_EXPECT = /(?<![\w$.])expect\(\s*$/;
const BEFORE_REFUSAL = /(?<![\w$.])expectRefusal\(\s*$/;
const OK_TO_BE = /^\.ok\s*\)\s*\.toBe\(\s*(?:true|false)\s*\)/;
const TO_MATCH = /^\s*\)\s*\.toMatchObject\(/;

/** Where a name is read in a source: the scanned code, the source itself, the offset and the name. */
export interface Use {
  readonly code: string;
  readonly source: string;
  readonly at: number;
  readonly name: string;
}

/**
 * Whether a variable holding a `Result` is read here by an assertion this migration rewrites:
 * `expect(result.ok).toBe(true)`, `expect(result).toMatchObject({ ok: false, error: { code } })`
 * or `expectRefusal(result, code)`.
 */
export function isAssertedUse({ code, source, at, name }: Use): boolean {
  const before = code.slice(Math.max(0, at - 40), at);
  const after = code.slice(at + name.length);

  if (BEFORE_REFUSAL.test(before)) {
    return /^\s*,/.test(after);
  }

  if (!BEFORE_EXPECT.test(before)) {
    return false;
  }

  const matched = TO_MATCH.exec(after);

  if (matched === null) {
    return OK_TO_BE.test(after);
  }

  const open = at + name.length + matched[0].length - 1;

  return refusalCode(source.slice(open + 1, matchingBracket(code, open))) !== undefined;
}
