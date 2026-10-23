import { LARGE_CHUNK, LARGE_SIZE } from './contents';

/** Six mebibytes in chunks of 64 KiB, each filled with its rank: never held whole. */
export async function* largeContent(): AsyncIterable<Uint8Array> {
  for (let offset = 0; offset < LARGE_SIZE; offset += LARGE_CHUNK) {
    yield new Uint8Array(LARGE_CHUNK).fill(offset / LARGE_CHUNK);
  }
}
