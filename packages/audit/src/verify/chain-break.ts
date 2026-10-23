import type { ChainBreakKind } from './chain-break-kind';

export interface ChainBreak {
  readonly kind: ChainBreakKind;

  readonly chain: string;

  /** Index, among the examined entries of the chain, where the chain stops holding. */
  readonly position: number;

  /** The sequence expected at that position. */
  readonly sequence: number;

  /** The entry found there, when there is one. */
  readonly entryId?: string;
}
