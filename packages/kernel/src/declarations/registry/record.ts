import type { Declaration } from '../model/declaration';
import type { DeclaredClass } from '../model/declared-class';
import { DeclarationError } from './declaration-error';
import { registry } from './registry';

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
