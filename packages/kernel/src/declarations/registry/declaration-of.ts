import type { Declaration } from '../model/declaration';
import type { DeclaredClass } from '../model/declared-class';
import { registry } from './registry';

/** What the class said about itself, or `undefined` for a class that carries no declaration. */
export function declarationOf(target: unknown): Declaration | undefined {
  return isClass(target) ? registry().byClass.get(target) : undefined;
}

function isClass(value: unknown): value is DeclaredClass {
  return typeof value === 'function';
}
