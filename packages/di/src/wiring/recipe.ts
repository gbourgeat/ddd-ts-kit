import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { Binding } from './binding';
import type { Resolve } from './resolve';

/** How a binding makes what it is asked for: the part of a binding its source decides. */
export type Recipe = Pick<Binding, 'source' | 'implementation' | 'dependencies' | 'create'>;

export function classRecipe(
  implementation: new (...args: never) => unknown,
  dependencies: readonly Token<unknown>[] = [],
): Recipe {
  return {
    source: 'class',
    implementation: implementation.name,
    dependencies,
    create: (resolve): unknown => Reflect.construct(implementation, dependencies.map(resolve)),
  };
}

export function factoryRecipe(factory: (resolve: Resolve) => unknown): Recipe {
  return { source: 'factory', dependencies: [], create: factory };
}

export function valueRecipe(value: unknown): Recipe {
  return { source: 'value', dependencies: [], create: () => value };
}
