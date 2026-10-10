import { tokenIdentity, type Token } from '@ddd-ts-kit/kernel/declarations';

export function sameToken(left: Token<unknown>, right: Token<unknown>): boolean {
  return tokenIdentity(left) === tokenIdentity(right);
}
