/** The tags in groups of at most `size`, for caches that bound the tags of one request. */
export function chunksOf(tags: readonly string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let start = 0; start < tags.length; start += size) {
    chunks.push(tags.slice(start, start + size));
  }

  return chunks;
}
