import type { Config } from '../config';

/** The entry point of `@ddd-ts-kit/di` that makes the applications of the project, the one of its container. */
export function diEntry(config: Config): string {
  return `@ddd-ts-kit/di/${config.stack.di}`;
}
