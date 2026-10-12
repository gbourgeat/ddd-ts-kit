import type { Guard } from './guard.js';

/** A guard as a group or a controller names it: the value itself, or the declared class the composition root builds. */
export type GuardReference = Guard | (abstract new (...args: never) => Guard);
