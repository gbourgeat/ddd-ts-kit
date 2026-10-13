import type { IncomingFile } from '../route/incoming-file.js';

/** What an upload reader found in a request: the text fields sent before the file, and the file. */
export interface ReceivedUpload {
  readonly fields: Readonly<Record<string, string>>;
  readonly file: IncomingFile;
}
