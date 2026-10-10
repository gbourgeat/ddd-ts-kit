/** The last entry of a chain, which the next one links to. */
export interface ChainHead {
  readonly chain: string;

  /** 0 for a chain that holds no entry yet. */
  readonly sequence: number;

  readonly hash: string;
}
