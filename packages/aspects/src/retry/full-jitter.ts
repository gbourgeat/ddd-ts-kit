import type { Jitter } from './jitter';

/**
 * A delay anywhere between zero and the computed one, so that callers failing together do not
 * retry together. Give a seeded `random` to make it deterministic.
 */
export function fullJitter(random: () => number = Math.random): Jitter {
  return (delayMs) => random() * delayMs;
}
