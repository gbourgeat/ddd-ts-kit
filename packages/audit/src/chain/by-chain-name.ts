import type { ChainHead } from './chain-head';

/**
 * The order of the heads of a trail, the same in every store: by the UTF-16 code units of the
 * name of the chain, as JavaScript sorts texts, whatever the collation of the database.
 */
export function byChainName(one: ChainHead, other: ChainHead): number {
  return one.chain < other.chain ? -1 : Number(one.chain > other.chain);
}
