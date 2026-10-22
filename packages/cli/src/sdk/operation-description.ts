import type { ClientOperation } from './client-operation';

/** What the comment of an operation says: its summary, its method and path, its error codes, and whether it is deprecated. */
export function operationDescription(operation: ClientOperation): string {
  const summary = operation.summary === '' ? operation.name : operation.summary;

  const codes = operation.responses.flatMap((response) => response.codes.map((code) => `${code} (${response.status})`));

  return [
    `${summary}: \`${operation.method} ${operation.path}\`.`,
    ...(codes.length === 0 ? [] : ['', `Error codes: ${codes.join(', ')}.`]),
    ...(operation.deprecated ? ['', '@deprecated The contract marks it deprecated.'] : []),
  ].join('\n');
}
