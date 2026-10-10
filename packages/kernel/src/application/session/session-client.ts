/** Where the session is used from. Opaque strings: never parsed, never trusted. */
export interface SessionClient {
  readonly ip?: string;
  readonly userAgent?: string;
}
