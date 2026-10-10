import type { Token } from './token.js';

export function describeToken(target: Token<unknown>): string {
  return target.name === '' ? 'anonymous class' : target.name;
}
