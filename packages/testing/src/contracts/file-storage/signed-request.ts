/** A request to a signed link, as a client would send it. */
export interface SignedRequest {
  readonly url: string;
  readonly method: 'GET' | 'PUT';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
}
