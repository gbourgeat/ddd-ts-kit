/** A content of a test as the stream a connector receives. */
export async function* chunksOf(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield bytes;
}
