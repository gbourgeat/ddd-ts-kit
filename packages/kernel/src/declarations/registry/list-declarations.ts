import type { DeclaredEntry } from './declared-entry';
import { registry } from './registry';

/** Every declared class this process still holds, in declaration order. For diagnostics. */
export function listDeclarations(): readonly DeclaredEntry[] {
  const { byClass, classes } = registry();
  const entries: DeclaredEntry[] = [];

  for (const reference of classes) {
    const target = reference.deref();
    const declaration = target === undefined ? undefined : byClass.get(target);

    if (target === undefined || declaration === undefined) {
      classes.delete(reference);
    } else {
      entries.push({ target, declaration });
    }
  }

  return entries;
}
