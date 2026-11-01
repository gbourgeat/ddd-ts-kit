/** One call of the REST API: `{ method: 'GET', path: '/appointments-acme/_doc/a1' }`. */
export interface OpenSearchRequest {
  readonly method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  /** From the root of the node, every segment already encoded. */
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  /** Sent as JSON. */
  readonly body?: unknown;
}

/** What the node answered, whatever its status: the store reads a 404 or a 409 as an answer. */
export interface OpenSearchResponse {
  readonly status: number;
  /** The JSON of the answer, `undefined` when it had none. */
  readonly body: unknown;
}

/**
 * How the store reaches a node: `fetchTransport` by default, or the official client of a project
 * wrapped in these few lines (`client.transport.request`). It answers every status, and rejects
 * only when no answer came.
 */
export interface OpenSearchTransport {
  request(request: OpenSearchRequest): Promise<OpenSearchResponse>;
}
