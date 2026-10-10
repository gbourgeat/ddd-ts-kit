import type { OpenApiDocument } from './open-api-document.js';
import { stringifyOpenApi } from './stringify-open-api.js';

/** Compares the generated contract with the committed one, ignoring line-ending style. */
export function checkOpenApiDrift(
  document: OpenApiDocument,
  existingFileContent: string,
): { drift: boolean } {
  return { drift: stringifyOpenApi(document) !== existingFileContent.replaceAll('\r\n', '\n') };
}
