import type { Stack } from './stack.js';

/** The stack as the config file holds it. The assembly is a choice of the declared style only: an explicit project has a module file and nothing to assemble. */
export function writtenStack(stack: Stack): Partial<Stack> {
  const { assembly, packageManager, ...rest } = stack;

  return stack.style === 'declared' ? { ...rest, assembly, packageManager } : { ...rest, packageManager };
}
