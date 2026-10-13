/** What a negotiated answer is written as: its bytes, its chunks for a streamed list, or the value for JSON, and the headers that say so. */
export interface RepresentedAnswer {
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly stream?: AsyncIterable<string>;
}
