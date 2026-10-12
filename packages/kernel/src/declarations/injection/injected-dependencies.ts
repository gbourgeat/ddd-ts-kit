import type { Dependencies } from '../dependencies/dependencies.js';
import type { DeclaredClass } from '../model/declared-class.js';
import { injectedRegistry } from './injected-registry.js';

/** The list `injected` registered for the class, or `undefined` when no generated file named it. */
export function injectedDependencies(target: unknown): Dependencies | undefined {
  return isClass(target) ? injectedRegistry().get(target) : undefined;
}

function isClass(value: unknown): value is DeclaredClass {
  return typeof value === 'function';
}
