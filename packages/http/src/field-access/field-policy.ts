import type { Actor } from '@ddd-ts-kit/kernel';

/**
 * A rule about one element that decides a field, as `definePolicy` of `@ddd-ts-kit/auth` writes
 * one: a policy of that package is one, with no import of it here.
 */
export interface FieldPolicy {
  readonly name: string;

  appliesTo?(subject: unknown): boolean;

  allows(actor: Actor, subject: unknown, context: { readonly now: Date }): boolean | { readonly allowed: boolean };
}
