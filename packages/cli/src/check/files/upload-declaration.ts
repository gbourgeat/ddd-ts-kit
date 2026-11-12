import type { StringRecord } from '../scan/string-record';

/** An upload a route declares, as far as its text says it: the media types it accepts and those it states a content rule for. */
export interface UploadDeclaration {
  readonly mediaTypes: readonly StringRecord[];
  readonly stated: readonly StringRecord[];
}
