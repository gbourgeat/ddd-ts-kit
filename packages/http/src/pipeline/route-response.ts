export interface RouteResponse {
  readonly status: number;
  /** Lower-case names. `content-type` is set whenever there is a body. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  /** The chunks of a body written as it is read, a streamed list: an adapter writes them in order, and `body` is then absent. */
  readonly stream?: AsyncIterable<string>;
}
