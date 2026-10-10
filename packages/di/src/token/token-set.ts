import type { Token } from '@ddd-ts-kit/kernel/declarations';
import { TokenMap } from './token-map.js';

export class TokenSet {
  private readonly members = new TokenMap<true>();

  constructor(tokens: Iterable<Token<unknown>> = []) {
    for (const target of tokens) this.add(target);
  }

  has(target: Token<unknown>): boolean {
    return this.members.has(target);
  }

  add(target: Token<unknown>): void {
    this.members.set(target, true);
  }

  tokens(): Token<unknown>[] {
    return this.members.keys();
  }
}
