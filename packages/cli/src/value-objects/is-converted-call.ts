import { BRACKETS } from '../check/text/brackets.js';
import type { ResultMethods } from './result-methods.js';

const STATIC_CALLEE = /(?<![\w$.])([A-Z][\w$]*)\s*\.\s*([\w$]+)\s*$/;
const INSTANCE_CALLEE = /[\w$)\]]\s*\.\s*([\w$]+)\s*$/;

/**
 * Whether the code between two offsets is one call, and nothing else, of a method that returned
 * a `Result`: `Email.create(raw)`, `booking.movedTo(slot, day)`, `Booking.create(x).movedTo(..)`.
 * `code` is the scanned code, the contents of strings and comments blanked, so that a
 * parenthesis in a string is not one. A trailing comma of an argument list is allowed.
 */
export function isConvertedCall(code: string, range: { start: number; end: number }, methods: ResultMethods): boolean {
  const text = code.slice(range.start, range.end).trim().replace(/,$/, '').trimEnd();
  const open = text.endsWith(')') ? openingParenthesis(text) : undefined;
  const callee = open === undefined ? undefined : text.slice(0, open);

  return callee !== undefined && isWholeCallee(callee) && namesConverted(callee, methods);
}

function namesConverted(callee: string, methods: ResultMethods): boolean {
  const named = STATIC_CALLEE.exec(callee);

  if (named !== null && methods.statics.has(`${named[1] ?? ''}.${named[2] ?? ''}`)) {
    return true;
  }

  return methods.instance.has(INSTANCE_CALLEE.exec(callee)?.[1] ?? '');
}

/** The offset of the parenthesis opening the call that closes the text, read backwards. */
function openingParenthesis(text: string): number | undefined {
  let depth = 0;

  for (let i = text.length - 1; i >= 0; i -= 1) {
    const char = text.charAt(i);

    depth += BRACKETS.closers.includes(char) ? 1 : BRACKETS.openers.includes(char) ? -1 : 0;

    if (depth === 0) {
      return i;
    }
  }

  return undefined;
}

/** A callee is a chain of members and calls, never an operator applied to one: `a ? b : c.create` is not a call of `create`. */
function isWholeCallee(callee: string): boolean {
  let depth = 0;

  for (const char of callee) {
    depth += BRACKETS.openers.includes(char) ? 1 : BRACKETS.closers.includes(char) ? -1 : 0;

    if (depth === 0 && !/[\w$.\s)\]]/.test(char)) {
      return false;
    }
  }

  return true;
}
