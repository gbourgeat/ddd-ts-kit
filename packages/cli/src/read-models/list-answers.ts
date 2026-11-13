import type { DeclaredClasses } from './declared-classes';
import type { ReadModelList } from './read-model-list';

/** A class of a context, by its name and, when it is known, its file. */
interface Named {
  readonly context: string;
  readonly name: string;
  readonly file?: string;
}

/**
 * What the list answers for, worked out once from its entries: the names each entry stands for
 * (the class it names, read by the name its file gives it, and every class that one extends, so
 * that a class written to build a store answers for that store), and the files an entry imports
 * through, a barrel that re-exports from the file of a store, under another name or not.
 */
export class ListAnswers {
  private readonly names = new Map<string, Set<string>>();
  private readonly files = new Map<string, Set<string>>();
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
  lists({ context, name, file }: Named): boolean {
    return (
      this.names.get(context)?.has(name) === true || (file !== undefined && this.files.get(context)?.has(file) === true)
    );
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
    const files = this.files.get(context) ?? new Set<string>();

    this.names.set(context, names);
    this.files.set(context, files);

    for (const name of this.classes.lineage(local)) {
      const through = this.fileBehind(name);

      names.add(name);
      this.classes.lineage(this.nameBehind(name)).forEach((behind) => names.add(behind));
      (through === undefined ? [] : this.classes.reexportedBy(through)).forEach((reexported) => files.add(reexported));
    }
  }

  /** The file a name of the list is imported from, when it is one of the project. */
  private fileBehind(name: string): string | undefined {
    const target = this.list.imports.get(name)?.target;

    return target?.kind === 'file' ? target.path : undefined;
  }

  /** The name a class of the list has in the file that declares it: an alias and a default import are read through. */
  private nameBehind(name: string): string {
    const imported = this.list.imports.get(name);
    const through = this.fileBehind(name);

    if (imported?.name === 'default') {
      return (through === undefined ? undefined : this.classes.defaultOf(through)?.shape.name) ?? name;
    }

    return imported?.name ?? name;
  }
}
