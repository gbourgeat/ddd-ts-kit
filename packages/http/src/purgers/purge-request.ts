/** One HTTP request that purges, as a purger builds it. */
export interface PurgeRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}
