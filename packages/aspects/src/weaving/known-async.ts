import type { Method } from './method.js';

/** Shared by every instance of a class: one call returning a thenable teaches them all. */
export const knownAsync = new WeakSet<Method>();
