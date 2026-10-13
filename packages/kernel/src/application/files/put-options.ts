export interface PutOptions {
  /** The media type the content was verified to be. */
  readonly mediaType: string;
  /** Beyond it the write fails with `FILE_TOO_LARGE` and leaves nothing under the key. */
  readonly maxBytes?: number;
}
