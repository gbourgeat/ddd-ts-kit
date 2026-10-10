import type { Declaration } from '../model/declaration.js';
import type { DeclaredClass } from '../model/declared-class.js';
import { DeclarationError } from './declaration-error.js';
import { registry } from './registry.js';

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
