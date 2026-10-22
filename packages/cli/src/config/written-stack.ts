import type { Stack } from './stack';

/**
 * The stack as the config file holds it. The assembly and where dependencies are stated are
 * choices of the declared style only: an explicit project has a module file, which assembles
 * the context and lists what each class is given.
 */
export function writtenStack(stack: Stack): Partial<Stack> {
  const { assembly, dependencies, packageManager, tenancy, ...rest } = stack;
  // A project of one customer says nothing of tenancy, as every project did before the choice existed.
  const tenant = tenancy === 'none' ? {} : { tenancy };

  return stack.style === 'declared'
    ? { ...rest, assembly, dependencies, packageManager, ...tenant }
    : { ...rest, packageManager, ...tenant };
}
