import type { AsyncApiDocument } from './async-api-document.js';
import { stringifyAsyncApi } from './stringify-async-api.js';

/** Compares the generated document with the committed one, ignoring line-ending style. */
export function checkAsyncApiDrift(document: AsyncApiDocument, existingFileContent: string): { drift: boolean } {
  return { drift: stringifyAsyncApi(document) !== existingFileContent.replaceAll('\r\n', '\n') };
}
