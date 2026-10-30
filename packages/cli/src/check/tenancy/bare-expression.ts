import { endOfEnclosing } from './end-of-enclosing';

/** A type stated after an expression, which says nothing of what it holds: `{ id } satisfies Filter`, `row as Row`. */
const STATED_TYPE = /\s+(?:as|satisfies)\s+[\w$.<>[\]\s|]+$/;

/** An expression trimmed, without the type stated after it and the parentheses around all of it. */
export function bareExpression(text: string): string {
  const bare = text.trim().replace(STATED_TYPE, '');

  return bare.startsWith('(') && endOfEnclosing(bare, 1) === bare.length - 1 ? bareExpression(bare.slice(1, -1)) : bare;
}
