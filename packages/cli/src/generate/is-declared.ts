import type { Config } from '../config/index.js';

/** The classes of the project say what they are with a decorator, and are their own registration. */
export function isDeclared(config: Config): boolean {
  return config.stack.style === 'declared';
}
