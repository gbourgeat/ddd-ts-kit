import { describeToken } from './describe-token.js';
import type { Token } from './token.js';

/**
 * What a container keys a token by. A class is its own identity, which two copies of a package
 * loaded in one process do not share: a class that declares `static readonly tokenKey` is
 * known by that key instead, the same in every copy. The ports of the kernel carry theirs as
 * an own property that is not a declared member, so that a port extending one of them declares
 * its own key without `override`.
 */
export function tokenIdentity(target: Token<unknown>): symbol {
  const key = stableKeyOf(target);

  if (key !== undefined) {
    return Symbol.for(`@ddd-ts-kit/token/${key}`);
  }

  const identities = identitiesByClass();
  const known = identities.get(target);

  if (known !== undefined) {
    return known;
  }

  const identity = Symbol(describeToken(target));

  identities.set(target, identity);

  return identity;
}

function stableKeyOf(target: Token<unknown>): string | undefined {
  if (!Object.hasOwn(target, 'tokenKey')) {
    return undefined;
  }

  const key: unknown = Reflect.get(target, 'tokenKey');

  return typeof key === 'string' && key !== '' ? key : undefined;
}

/*
 * One map per process, whatever the number of copies of this package it loaded: two
 * containers built on two copies give one class one identity.
 */
const IDENTITIES = Symbol.for('@ddd-ts-kit/kernel/token-identities/v1');

function identitiesByClass(): WeakMap<Token<unknown>, symbol> {
  const existing: unknown = Reflect.get(globalThis, IDENTITIES);

  if (isIdentityMap(existing)) {
    return existing;
  }

  const created = new WeakMap<Token<unknown>, symbol>();

  Reflect.set(globalThis, IDENTITIES, created);

  return created;
}

function isIdentityMap(value: unknown): value is WeakMap<Token<unknown>, symbol> {
  return value instanceof WeakMap;
}
