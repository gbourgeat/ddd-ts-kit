export interface ClaimWindow {
  readonly now: Date;
  /** True when the claim returned fewer records than asked: nothing else was due. */
  readonly complete: boolean;
}
