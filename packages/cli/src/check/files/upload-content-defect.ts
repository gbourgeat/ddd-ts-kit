import type { StringRecord } from '../scan/string-record';

/** A string of an upload declaration and what is wrong with it. */
export interface UploadContentDefect {
  readonly literal: StringRecord;
  readonly message: string;
}
