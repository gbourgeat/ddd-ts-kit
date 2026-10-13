/** What a client needs to send a file straight to the storage: the request to make, and until when. */
export interface SignedUpload {
  readonly url: string;
  readonly method: 'PUT';
  /** To send as they are: the signature covers them. */
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}
