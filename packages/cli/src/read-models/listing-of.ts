import { toName } from '../naming';
import type { ImportedClass } from './read-model-list';

/** A read model store to list: its context, its class, its file and what that file is imported by. */
export interface ListedStore {
  readonly context: string;
  readonly store: string;
  readonly from: string;
  /** Its file, from the root of the project, when the caller knows it. */
  readonly file?: string;
}

/** The lines that list a store: its import, when the list does not hold it already, and its entry. */
export interface Listing {
  readonly imported: string | undefined;
  /** The name the list gives the class. */
  readonly local: string;
  readonly entry: string;
}

/**
 * The lines that add a store to a list that imports `imports`: `import { <Store> } from '<file>';`
 * and `['<context>', <Store>],`. A list that already imports the class from its file gets the
 * entry alone, under the name it gave it. A name the list already binds, the store of the same
 * name in another context, is imported under an alias that carries its context,
 * `import { KnexSummaries as ShippingKnexSummaries }`: two imports of one name would not compile.
 */
export function listingOf(imports: ReadonlyMap<string, ImportedClass>, listed: ListedStore): Listing {
  const { context, store, from, file } = listed;

  const [held] = [...imports].flatMap(([local, { name, target }]) =>
    name === store && target.kind === 'file' && target.path === file ? [local] : [],
  );

  if (held !== undefined) {
    return { imported: undefined, local: held, entry: `['${context}', ${held}],` };
  }

  const local = imports.has(store) ? `${toName(context).pascal}${store}` : store;

  return {
    imported: `import { ${local === store ? store : `${store} as ${local}`} } from '${from}';`,
    local,
    entry: `['${context}', ${local}],`,
  };
}
