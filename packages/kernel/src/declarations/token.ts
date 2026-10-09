declare const tokenType: unique symbol;

/**
 * A typed injection token: a unique symbol that also carries the type it resolves to, so a
 * dependency list is checked against a constructor and `resolve(token)` is typed.
 */
export type Token<T> = symbol & { readonly [tokenType]: T };

export function token<T>(description: string): Token<T> {
  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the brand exists at compile time only: nothing but an assertion can turn a plain symbol into a Token<T>
  return Symbol(description) as Token<T>;
}

/**
 * A token of the kit itself, the same symbol in every copy of this package a process happens
 * to load: a context declared against one copy is wired by a container holding another.
 */
export function standardToken<T>(description: string): Token<T> {
  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the brand exists at compile time only: nothing but an assertion can turn a plain symbol into a Token<T>
  return Symbol.for(description) as Token<T>;
}

export function describeToken(target: Token<unknown>): string {
  return target.description ?? 'anonymous token';
}
