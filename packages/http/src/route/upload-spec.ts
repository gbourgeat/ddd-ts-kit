/**
 * The file a route receives, in a `multipart/form-data` request: the field that carries it, the
 * most it may weigh and the media types it may be. All three are part of the contract (the
 * OpenAPI document states them) and are enforced while the content streams.
 */
export interface UploadSpec {
  readonly field: string;
  readonly maxBytes: number;
  /** Exact types or families (`image/*`), verified on the first bytes of the content, never on the file name. */
  readonly mediaTypes: readonly string[];
}
