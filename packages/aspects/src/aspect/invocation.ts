/** One call. `proceed` runs what is inside, with the same arguments unless others are given. */
export interface Invocation {
  readonly args: readonly unknown[];
  readonly proceed: (args?: readonly unknown[]) => Promise<unknown>;
}
