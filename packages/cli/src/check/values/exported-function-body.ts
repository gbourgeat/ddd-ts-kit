import type { Exported } from '../exports/exported.js';
import { signatureAt } from '../structure/signature-at.js';
import { arrowBody } from './arrow-body.js';
import type { FunctionBody } from './function-body.js';
import { initializerOf } from './initializer-of.js';

const FUNCTION_EXPRESSION = /^(?:async\s+)?function\b[\s*]*(?:[\w$]+)?\s*(?:<[^()]*>)?\s*\(/;

/**
 * The body of an exported function, in the text of its declaration: a function declaration, or
 * a constant bound to an arrow or a function expression. Undefined for anything else, and for an
 * overload, which has no body.
 */
export function exportedFunctionBody({ kind, text, signature }: Exported): FunctionBody | undefined {
  if (kind === 'function') {
    const open = signature.length;

    return text.charAt(open) === '{' ? { kind: 'block', open, close: text.length - 1 } : undefined;
  }

  if (kind !== 'const') {
    return undefined;
  }

  const start = initializerOf(text);

  if (start === undefined) {
    return undefined;
  }

  const expression = FUNCTION_EXPRESSION.exec(text.slice(start));

  if (expression === null) {
    return arrowBody(text, start);
  }

  const body = signatureAt(text, start + expression[0].length - 1);

  return body === undefined ? undefined : { kind: 'block', open: body.bodyOpen, close: body.bodyClose };
}
