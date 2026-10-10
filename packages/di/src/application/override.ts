import type { Token } from '@ddd-ts-kit/kernel/declarations';

export type Override = readonly [token: Token<unknown>, value: unknown];

/** A type-checked override pair for `createApplication({ overrides })`: `override(Clock, new FixedClock())`. */
export function override<T>(target: Token<T>, value: T): Override {
  return [target, value];
}
