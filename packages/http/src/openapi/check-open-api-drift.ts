import type { OpenApiDocument } from './open-api-document';
import { stringifyOpenApi } from './stringify-open-api';

/** Compares the generated contract with the committed one, ignoring line-ending style. */
export function checkOpenApiDrift(document: OpenApiDocument, existingFileContent: string): { drift: boolean } {
  return { drift: stringifyOpenApi(document) !== existingFileContent.replaceAll('\r\n', '\n') };
}
