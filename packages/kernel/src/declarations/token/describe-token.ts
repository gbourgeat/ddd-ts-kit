import type { Token } from './token';

export function describeToken(target: Token<unknown>): string {
  return target.name === '' ? 'anonymous class' : target.name;
}
