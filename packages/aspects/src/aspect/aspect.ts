import type { AspectInfo } from './aspect-info';

/**
 * Cross-cutting behaviour applied from outside: takes an instance, answers it with its
 * asynchronous methods wrapped. The instance is the same object (a proxy stands in for a
 * frozen one), so `this`, `instanceof` and its private members keep working, and applying the
 * same aspect twice is a no-op.
 */
export type Aspect = <T extends object>(instance: T, info?: AspectInfo) => T;
