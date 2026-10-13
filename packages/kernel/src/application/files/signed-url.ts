/** A link that grants one action on one file until it expires, without any other credential. */
export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
}
