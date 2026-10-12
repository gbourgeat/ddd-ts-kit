import type { Readable } from 'node:stream';
import type { FileMetadata } from './file-metadata.js';

/** A file being read: what the storage knows of it, and its content as a stream to consume once. */
export interface FileContent {
  readonly metadata: FileMetadata;
  readonly stream: Readable;
}
