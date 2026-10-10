export const RESOLVE = Symbol('ddd-ts-kit.testing.resolve');

/** Something that yields a value at build time: a nested builder, `lazy`, `sequence`. */
export interface Resolvable<T> {
  [RESOLVE](): T;
}
