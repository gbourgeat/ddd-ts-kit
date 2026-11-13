import { escapeRegExp } from '../check/text/escape-reg-exp';
import { toName } from '../naming';

/** A read model store to list: its context, its class and what its file is imported by. */
export interface ListedStore {
  readonly context: string;
  readonly store: string;
  readonly from: string;
}

/** The two lines that list a store: its import and its entry. */
export interface Listing {
  readonly imported: string;
  readonly entry: string;
}

/**
 * The lines that add a store to a list that holds `held`: `import { <Store> } from '<file>';` and
 * `['<context>', <Store>],`. A class name the list already holds, the store of the same name in
 * another context, is imported under an alias that carries its context,
 * `import { KnexSummaries as ShippingKnexSummaries }`: two imports of one name would not compile.
 */
export function listingOf(held: string, { context, store, from }: ListedStore): Listing {
  const taken = new RegExp(`\\b${escapeRegExp(store)}\\b`).test(held);
  const local = taken ? `${toName(context).pascal}${store}` : store;

  return {
    imported: `import { ${taken ? `${store} as ${local}` : store} } from '${from}';`,
    entry: `['${context}', ${local}],`,
  };
}
