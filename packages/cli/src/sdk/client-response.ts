/** A status an operation declares: its body, read as JSON, text or nothing, and the error codes of a problem. */
export interface ClientResponse {
  readonly status: number;
  readonly read: 'json' | 'text' | 'none';
  readonly schema: unknown;
  /** The codes `x-error-codes` lists for this status; empty for a success. */
  readonly codes: readonly string[];
  readonly description: string;
}
