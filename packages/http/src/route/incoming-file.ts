import type { Readable } from 'node:stream';

/** The file of an upload as a handler receives it: still streaming, checked on its way. */
export interface IncomingFile {
  /** The name the client gave: shown back to a person, never a key or a path. */
  readonly fileName: string;
  /** The media type the client declared, which the first bytes must prove. */
  readonly mediaType: string;
  /**
   * The content, to consume once and to hand to the storage as it is. It fails on its way with
   * `FILE_TOO_LARGE` or `UNSUPPORTED_MEDIA_TYPE`, before a refused byte goes on.
   */
  readonly stream: Readable;
}
