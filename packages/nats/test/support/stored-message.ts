/** A message as a stream keeps it. */
export interface StoredMessage {
  readonly subject: string;
  readonly body: string;
  readonly headers: Record<string, string>;
}
