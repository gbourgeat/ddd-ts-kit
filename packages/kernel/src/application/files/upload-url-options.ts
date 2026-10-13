export interface UploadUrlOptions {
  /** Short: at most `MAX_SIGNED_URL_SECONDS`. */
  readonly expiresInSeconds: number;
  /** The media type the client must send, as the `content-type` the signature covers. */
  readonly mediaType: string;
  /**
   * In bytes. The storages the application serves refuse a larger upload; a presigned link of
   * an object store cannot cap it, so `FileStaging.confirm` checks it again in every case.
   */
  readonly maxBytes: number;
}
