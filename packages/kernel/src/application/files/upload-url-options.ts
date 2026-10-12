export interface UploadUrlOptions {
  /** Short: at most `MAX_SIGNED_URL_SECONDS`. */
  readonly expiresInSeconds: number;
  /** The media type the client must send, as the `content-type` the signature covers. */
  readonly mediaType: string;
}
