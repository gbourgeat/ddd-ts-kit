import { createHash } from 'node:crypto';
import type { FileStorage } from '@ddd-ts-kit/kernel';

/** SHA-256 of a file as the storage gives it back, in lower-case hexadecimal; undefined when the storage has none under the key. */
export async function storedDigest(files: FileStorage, key: string): Promise<string | undefined> {
  const stored = await files.get(key);

  if (stored === undefined) {
    return undefined;
  }

  const hash = createHash('sha256');

  for await (const chunk of stored.stream) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return hash.digest('hex');
}
