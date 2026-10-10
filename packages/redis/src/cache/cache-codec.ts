/** How a value becomes the text the server stores, and back. */
export interface CacheCodec {
  encode(value: unknown): string;

  decode(text: string): unknown;
}
