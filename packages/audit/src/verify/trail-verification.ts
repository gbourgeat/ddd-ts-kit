import type { ChainBreak } from './chain-break';

/** What a verification of every chain of a trail found: the entries examined, and the first break of each chain that has one. */
export interface TrailVerification {
  readonly valid: boolean;
  readonly checked: number;
  readonly breaks: readonly ChainBreak[];
}
