import { wholeLiteral } from '../declarations/whole-literal';
import type { Scan } from '../scan/scan';
import { callArguments } from '../text/call-arguments';
import type { ErrorCode } from './error-code';
import { refusalClasses } from './refusal-classes';

const REFUSAL_CALL = /\.\s*refusal\s*\(/g;
const CODE_FIELD = /\breadonly\s+code\s*(?::[^=;]+)?=\s*/g;

/**
 * The codes a source gives to its refusals, in both forms: the first argument of
 * `.refusal('CODE', ..)` in a factory, and the `readonly code = 'CODE'` field of a class per error.
 * The factories of a `DomainRefusal` give `refusal(..)` the message, never the code: their class
 * reads its code from the list of its context, which `listedCodes` reads.
 */
export function errorCodes(scan: Scan): ErrorCode[] {
  const named = refusalClasses(scan);

  const inNamedRefusal = (offset: number): boolean =>
    named.some((shape) => offset > shape.bodyStart && offset < shape.end);

  const built = [...scan.code.matchAll(REFUSAL_CALL)].flatMap((match) => {
    if (inNamedRefusal(match.index)) {
      return [];
    }

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
