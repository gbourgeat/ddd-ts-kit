export interface FetchTransportOptions {
  /** The node, or the load balancer in front of the cluster: `https://search.internal:9200`. */
  readonly node: string;
  /**
   * The credentials sent with every request: a user of the security plugin (basic), or the whole
   * `authorization` header (`ApiKey ...`, `Bearer ...`). Read from configuration, never written in code.
   */
  readonly auth?: { readonly username: string; readonly password: string } | { readonly authorization: string };
  /** How long a request may take before it is abandoned. Default: 10 000 ms. */
  readonly timeoutMs?: number;
}
