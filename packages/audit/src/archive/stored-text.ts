import type { FileStorage } from '@ddd-ts-kit/kernel';

/** A file as the storage gives it back, read as UTF-8; undefined when the storage has none under the key. */
export async function storedText(files: FileStorage, key: string): Promise<string | undefined> {
  const stored = await files.get(key);

  if (stored === undefined) {
    return undefined;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of stored.stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
}
