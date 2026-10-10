import type { OpenApiDocument } from './open-api-document.js';

/** The exact bytes to commit: two-space JSON and a trailing newline. */
export function stringifyOpenApi(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
