/** What a negotiated answer is written as: its bytes, or its chunks for a streamed list, and the headers that say so. */
export interface RepresentedAnswer {
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
  readonly stream?: AsyncIterable<string>;
}
