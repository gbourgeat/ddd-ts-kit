/**
 * The node refused a request the store did not expect it to refuse: a document that the strict
 * mapping does not hold, a mapping it cannot change, a cluster that refuses the credentials. The
 * `type` and `reason` are the ones OpenSearch gave; the body of the request is never repeated.
 */
export class OpenSearchRequestError extends Error {
  readonly code = 'OPENSEARCH_REQUEST_REFUSED';

  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly type: string | undefined,
    reason: string | undefined,
  ) {
    super(
      `OpenSearch answered ${String(status)} to ${method} ${path}${type === undefined ? '' : `: ${type}`}${reason === undefined ? '' : `, ${reason}`}`,
    );

    this.name = 'OpenSearchRequestError';
  }
}
