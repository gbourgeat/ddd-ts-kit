/** The whole content of a stream: for the small files of a test, never in an adapter. */
export async function readAll(stream: AsyncIterable<unknown>): Promise<Uint8Array> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk instanceof Uint8Array ? chunk : String(chunk)));
  }

  return new Uint8Array(Buffer.concat(chunks));
}
