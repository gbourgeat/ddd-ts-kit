/** A key an event wrote during a rebuild, and how many times so far. */
export interface TouchedKey {
  readonly key: string;
  readonly mark: number;
}
