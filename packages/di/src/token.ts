declare const tokenType: unique symbol;

/**
 * A typed injection token: a unique symbol (a valid tsyringe `InjectionToken`) that also
 * carries the type it resolves to, so `resolve(token)` is typed without any decorator.
 */
export type Token<T> = symbol & { readonly [tokenType]: T };

export function token<T>(description: string): Token<T> {
  // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the brand exists at compile time only: nothing but an assertion can turn a plain symbol into a Token<T>
  return Symbol(description) as Token<T>;
}

export function describeToken(target: Token<unknown>): string {
  return target.description ?? 'anonymous token';
}
