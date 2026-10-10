import { tokenIdentity, type Token } from '@ddd-ts-kit/kernel/declarations';

/**
 * Values by token. A token is looked up by its identity, so a port of the kit is one key
 * whatever copy of the kernel a class took it from.
 */
export class TokenMap<Value> {
  private readonly entries = new Map<symbol, readonly [token: Token<unknown>, value: Value]>();

  has(target: Token<unknown>): boolean {
    return this.entries.has(tokenIdentity(target));
  }

  get(target: Token<unknown>): Value | undefined {
    return this.entries.get(tokenIdentity(target))?.[1];
  }

  set(target: Token<unknown>, value: Value): void {
    this.entries.set(tokenIdentity(target), [target, value]);
  }

  keys(): Token<unknown>[] {
    return [...this.entries.values()].map(([target]) => target);
  }

  values(): Value[] {
    return [...this.entries.values()].map(([, value]) => value);
  }
}
