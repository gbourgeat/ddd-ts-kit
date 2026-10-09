import type { Declaration, DeclaredClass } from './declaration.js';

/** A declaration that cannot stand: written twice on one class, or on a class of another role. */
export class DeclarationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeclarationError';
  }
}

export interface DeclaredEntry {
  readonly target: DeclaredClass;
  readonly declaration: Declaration;
}

/** What the class said about itself, or `undefined` for a class that carries no declaration. */
export function declarationOf(target: unknown): Declaration | undefined {
  return isClass(target) ? registry().byClass.get(target) : undefined;
}

/** Every declared class this process still holds, in declaration order. For diagnostics. */
export function listDeclarations(): readonly DeclaredEntry[] {
  const { byClass, classes } = registry();
  const entries: DeclaredEntry[] = [];
  for (const reference of classes) {
    const target = reference.deref();
    const declaration = target === undefined ? undefined : byClass.get(target);
    if (target === undefined || declaration === undefined) classes.delete(reference);
    else entries.push({ target, declaration });
  }
  return entries;
}

export function record(target: DeclaredClass, declaration: Declaration): void {
  const { byClass, classes } = registry();
  const existing = byClass.get(target);
  if (existing !== undefined) {
    throw new DeclarationError(
      `${target.name} is declared twice: as ${existing.role} and as ${declaration.role}. A class plays one role.`,
    );
  }
  byClass.set(target, Object.freeze(declaration));
  classes.add(new WeakRef(target));
}

interface Registry {
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

function registry(): Registry {
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

function isClass(value: unknown): value is DeclaredClass {
  return typeof value === 'function';
}
