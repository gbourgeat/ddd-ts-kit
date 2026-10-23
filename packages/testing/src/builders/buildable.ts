import type { Resolvable } from './resolvable';

/**
 * What a builder accepts wherever a value of type `T` is expected: the value, something that
 * yields it at build time, or, for an array, a list mixing both.
 */
export type Buildable<T> = T | Resolvable<T> | (T extends readonly (infer Item)[] ? readonly Buildable<Item>[] : never);
