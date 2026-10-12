import type { Stack } from './stack.js';

/**
 * The stack as the config file holds it. The assembly and where dependencies are stated are
 * choices of the declared style only: an explicit project has a module file, which assembles
 * the context and lists what each class is given.
 */
export function writtenStack(stack: Stack): Partial<Stack> {
  const { assembly, dependencies, packageManager, ...rest } = stack;

  return stack.style === 'declared' ? { ...rest, assembly, dependencies, packageManager } : { ...rest, packageManager };
}
