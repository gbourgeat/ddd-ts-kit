import type { DomainError } from './domain-error.js';

// A static member typed `any` (`Error.prepareStackTrace`) is not a factory.
type Built<R> = 0 extends 1 & R ? never : R extends DomainError ? R : never;

type Factories<C> = { [K in keyof C]: C[K] extends (...args: never[]) => infer R ? Built<R> : never }[keyof C];

/**
 * The refusals the static factories of an error class build, as a union discriminated by
 * `code`: `RefusalOf<typeof AppointmentError>` is all of them, and
 * `RefusalOf<typeof AppointmentError, 'SLOT_TAKEN'>` the one of that code, with its facts.
 */
export type RefusalOf<C, Code extends string = string> = Extract<Factories<C>, { readonly code: Code }>;
