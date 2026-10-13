import { NOW } from './job-fixtures.js';

/** That many milliseconds after `NOW`. */
export function later(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}
