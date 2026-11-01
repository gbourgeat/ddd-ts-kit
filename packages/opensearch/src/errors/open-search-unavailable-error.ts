/** No answer came from the node: it cannot be reached, or it took longer than the timeout. */
export class OpenSearchUnavailableError extends Error {
  readonly code = 'OPENSEARCH_UNAVAILABLE';

  constructor(
    readonly method: string,
    readonly path: string,
    options: { readonly cause: unknown },
  ) {
    super(`OpenSearch did not answer ${method} ${path}`, options);
    this.name = 'OpenSearchUnavailableError';
  }
}
