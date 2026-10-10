import type { Declaration } from '../model/declaration.js';
import type { DeclaredClass } from '../model/declared-class.js';

export interface Registry {
  readonly byClass: WeakMap<DeclaredClass, Declaration>;
  readonly classes: Set<WeakRef<DeclaredClass>>;
}

/*
 * One registry per process, whatever the number of copies of this package it loaded (a
 * duplicated install, a bundle next to node_modules, a test runner next to a compiled file):
 * the global symbol registry is the only thing they all share. Classes are held weakly, so a
 * module reloaded by a watcher leaves no trace of its former classes.
 */
const REGISTRY = Symbol.for('@ddd-ts-kit/kernel/declarations/v1');

export function registry(): Registry {
  const existing: unknown = Reflect.get(globalThis, REGISTRY);

  if (isRegistry(existing)) return existing;

  const created: Registry = { byClass: new WeakMap(), classes: new Set() };

  Reflect.set(globalThis, REGISTRY, created);

  return created;
}

function isRegistry(value: unknown): value is Registry {
  if (typeof value !== 'object' || value === null) return false;

  if (!('byClass' in value) || !('classes' in value)) return false;

  return value.byClass instanceof WeakMap && value.classes instanceof Set;
}
