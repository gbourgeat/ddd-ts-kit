import type { Readable } from 'node:stream';

/** The content handed to a storage: always a stream of chunks, never the whole file in memory. */
export type FileSource = Readable | AsyncIterable<Uint8Array>;
