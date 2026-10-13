import type { Readable } from 'node:stream';

/**
 * A file received from a client, still streaming: what a controller hands to a command, and the
 * handler to `FileStaging.stage`. Nothing of it is trusted but its bytes, which the edge checks
 * against the declared media type as they stream.
 */
export interface ReceivedFile {
  /** The name the client gave: shown back to a person, never a key or a path. */
  readonly fileName: string;
  /** The media type the client declared, which the first bytes must prove. */
  readonly mediaType: string;
  /** The content, to consume once. It fails on its way with `FILE_TOO_LARGE` or `UNSUPPORTED_MEDIA_TYPE`. */
  readonly stream: Readable;
}
