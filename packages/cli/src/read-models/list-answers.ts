import type { DeclaredClasses } from './declared-classes';
import type { ReadModelList } from './read-model-list';

/** A class of a context, by its name. */
interface Named {
  readonly context: string;
  readonly name: string;
}

/**
 * What the list answers for, worked out once from its entries: the names each entry stands for.
 * An entry stands for the class it names, read by the name its file gives it (an alias, a default
 * import and one re-export, `export { A as B } from` or `export * from`, are read through), and
 * for every class that one extends, so that a class written to build a store answers for that
 * store. A file that re-exports several stores answers for the one the entry names, no other.
 */
export class ListAnswers {
  private readonly names = new Map<string, Set<string>>();
  private readonly notListed: ReadonlySet<string>;

  constructor(
    readonly list: ReadModelList,
    private readonly classes: DeclaredClasses,
  ) {
    this.notListed = new Set(list.notListed.map(({ context, store }) => `${context}: ${store}`));

    for (const { context, local } of list.entries) {
      this.listed(context, local);
    }
  }

  /** Whether an entry of `LISTED` under its context stands for the store. */
  lists({ context, name }: Named): boolean {
    return this.names.get(context)?.has(name) === true;
  }

  /**
   * Whether the list answers for a store: an entry stands for it, `NOT_LISTED` names it, or a
   * comment between the markers of the file holds `<context>: <Store>`, which leaves it out on
   * purpose.
   */
  holds(store: Named): boolean {
    const named = `${store.context}: ${store.name}`;

    return this.notListed.has(named) || this.list.leftOut.has(named) || this.lists(store);
  }

  /** One more entry, which `init` is about to write: the store it names, and what that one extends. */
  listed(context: string, local: string): void {
    const names = this.names.get(context) ?? new Set<string>();

    this.names.set(context, names);

    for (const name of this.classes.lineage(local)) {
      names.add(name);
      this.classes.lineage(this.nameBehind(name)).forEach((behind) => names.add(behind));
    }
  }

  /** The name a class of the list has in the file that declares it. */
  private nameBehind(name: string): string {
    const imported = this.list.imports.get(name);

    if (imported === undefined) {
      return name;
    }

    const declared =
      imported.target.kind === 'file' ? this.classes.behind(imported.target.path, imported.name) : undefined;

    return declared?.shape.name ?? (imported.name === 'default' ? name : imported.name);
  }
}
