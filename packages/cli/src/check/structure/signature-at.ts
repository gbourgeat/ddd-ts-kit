import { BRACKETS } from '../text/brackets.js';
import { matchingBracket } from '../text/matching-bracket.js';
import { splitParameters } from '../text/split-parameters.js';

export interface Signature {
  readonly parameters: readonly string[];
  readonly bodyOpen: number;
  readonly bodyClose: number;
  /** Lines holding code strictly inside the body. */
  readonly bodyLines: number;
}

const TYPE_LITERAL_PRECEDERS = ':|&<,(?[';

/** The signature whose parameter list opens at `openParenthesis`; undefined when it has no body. */
export function signatureAt(code: string, openParenthesis: number): Signature | undefined {
  const closeParenthesis = matchingBracket(code, openParenthesis);
  const bodyOpen = bodyStart(code, closeParenthesis + 1);

  if (bodyOpen === undefined) {
    return undefined;
  }

  const bodyClose = matchingBracket(code, bodyOpen);

  return {
    parameters: splitParameters(code.slice(openParenthesis + 1, closeParenthesis)),
    bodyOpen,
    bodyClose,
    bodyLines: countBodyLines(code.slice(bodyOpen + 1, bodyClose)),
  };
}

function countBodyLines(body: string): number {
  return body.split('\n').filter((line) => line.trim() !== '').length;
}

/**
 * From the parenthesis closing a parameter list, finds the brace opening the body, stepping
 * over a return type that may itself contain object types. Undefined for a bodiless signature.
 */
function bodyStart(code: string, afterParameters: number): number | undefined {
  let i = afterParameters;

  while (i < code.length) {
    const char = code.charAt(i);

    if (endsSignature(char, code.charAt(i + 1))) {
      return undefined;
    }

    if (char === '{' && !opensTypeLiteral(code.slice(afterParameters, i))) {
      return i;
    }

    i = BRACKETS.openers.includes(char) ? matchingBracket(code, i) + 1 : i + 1;
  }

  return undefined;
}

function endsSignature(char: string, next: string): boolean {
  return char === ';' || char === '}' || (char === '=' && next !== '>');
}

/** A brace after `=>` or after a character that only a type can end with opens an object type, not the body. */
function opensTypeLiteral(sinceParameters: string): boolean {
  const before = sinceParameters.trimEnd();
  const previous = before.charAt(before.length - 1);

  return before.endsWith('=>') || (previous !== '' && TYPE_LITERAL_PRECEDERS.includes(previous));
}
