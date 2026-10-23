import type { AsyncApiDocument } from './async-api-document';

/** The exact bytes to commit: two-space JSON and a trailing newline. */
export function stringifyAsyncApi(document: AsyncApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
