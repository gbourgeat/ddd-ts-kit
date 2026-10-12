import type { ClientDocument } from './client-document.js';

/** Every error code an operation of the document declares, in the order of the alphabet. */
export function errorCodes(document: ClientDocument): string[] {
  const codes = document.operations.flatMap((operation) => operation.responses.flatMap((response) => response.codes));

  return [...new Set(codes)].sort();
}
