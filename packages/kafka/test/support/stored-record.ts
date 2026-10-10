/** A record as a topic keeps it. */
export interface StoredRecord {
  readonly key: string | undefined;
  readonly value: string;
  readonly headers: Record<string, string>;
}
