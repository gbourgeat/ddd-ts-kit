import type { ChainHead } from './chain-head';
import { GENESIS_HASH } from './genesis-hash';

export function emptyChain(chain: string): ChainHead {
  return { chain, sequence: 0, hash: GENESIS_HASH };
}
