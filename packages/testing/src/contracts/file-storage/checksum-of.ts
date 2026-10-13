import { createHash } from 'node:crypto';

/** The checksum a connector answers, computed by the suite from what it wrote. */
export async function checksumOf(chunks: Iterable<Uint8Array> | AsyncIterable<Uint8Array>): Promise<string> {
  const hash = createHash('sha256');

  for await (const chunk of chunks) {
    hash.update(chunk);
  }

  return `sha256:${hash.digest('hex')}`;
}
