import { wholeLiteral } from '../declarations/whole-literal.js';
import type { Scan } from '../scan/scan.js';
import { callArguments } from '../text/call-arguments.js';
import type { ErrorCode } from './error-code.js';

const REFUSAL_CALL = /\.\s*refusal\s*\(/g;
const CODE_FIELD = /\breadonly\s+code\s*(?::[^=;]+)?=\s*/g;

/**
 * The codes a source gives to its refusals, in both forms: the first argument of
 * `.refusal('CODE', ..)` in a factory, and the `readonly code = 'CODE'` field of a class per error.
 */
export function errorCodes(scan: Scan): ErrorCode[] {
  const built = [...scan.code.matchAll(REFUSAL_CALL)].flatMap((match) => {
    const [code] = callArguments(scan.code, match.index + match[0].length - 1);
    const literal = code === undefined ? undefined : wholeLiteral(scan, code);

    return literal === undefined ? [] : [{ code: literal, line: scan.lineAt(match.index) }];
  });

  const fields = [...scan.code.matchAll(CODE_FIELD)].flatMap((match) => {
    const literal = scan.strings.find((candidate) => candidate.start === match.index + match[0].length);

    return literal === undefined ? [] : [{ code: literal.value, line: scan.lineAt(match.index) }];
  });

  return [...built, ...fields].sort((a, b) => a.line - b.line);
}
