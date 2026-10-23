import type { Config } from '../config';

/**
 * One program has one decorator mode: the legacy one wherever a library of the stack only has
 * legacy decorators (class-validator, NestJS), the standard one everywhere else. The declarations
 * of the kernel and the aspects serve both.
 */
export function usesLegacyDecorators(config: Config): boolean {
  return config.stack.http === 'nest' || config.stack.validation === 'class-validator';
}
