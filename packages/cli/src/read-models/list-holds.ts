import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { DeclaredClass } from './declared-class';
import { lineageOf } from './lineage-of';
import type { ReadModelList } from './read-model-list';

/** A class of a context, by its name. */
interface Named {
  readonly context: string;
  readonly name: string;
}

/**
 * Whether the list answers for a store: an entry of its context names it or a class that extends
 * it (the class the list declares to build a store it cannot build as it is, a class of the
 * project over it), `NOT_LISTED` names it, or a comment holds `<context>: <Store>`, which leaves
 * it out on purpose.
 */
export function listHolds(list: ReadModelList, classes: readonly DeclaredClass[], store: Named): boolean {
  return (
    list.notListed.some((named) => named.context === store.context && named.store === store.name) ||
    isLeftOut(list, store) ||
    list.entries.some(
      (entry) => entry.context === store.context && namesBehind(list, classes, entry.local).includes(store.name),
    )
  );
}

function isLeftOut(list: ReadModelList, { context, name }: Named): boolean {
  const named = new RegExp(`(?<![\\w$-])${escapeRegExp(context)}: ${escapeRegExp(name)}(?![\\w$])`);

  return list.comments.some((comment) => named.test(comment));
}

/** The names of the classes an entry stands for, an import under an alias read by the name its file gives it. */
function namesBehind(list: ReadModelList, classes: readonly DeclaredClass[], local: string): string[] {
  return lineageOf(classes, local).flatMap((name) => {
    const imported = list.imports.get(name);

    return imported === undefined || imported.name === name ? [name] : [name, ...lineageOf(classes, imported.name)];
  });
}
