import type { ChainHead } from './chain-head.js';
import { GENESIS_HASH } from './genesis-hash.js';

export function emptyChain(chain: string): ChainHead {
  return { chain, sequence: 0, hash: GENESIS_HASH };
}
