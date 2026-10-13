import type { ClientOperation } from './client-operation.js';
import { docComment } from './doc-comment.js';
import { isInputOptional } from './is-input-optional.js';
import { operationDescription } from './operation-description.js';
import { renderInput } from './render-input.js';
import { renderResult } from './render-result.js';
import { typeName } from './type-name.js';

/**
 * The types of one operation and its function, which holds what the client knows of it: no name
 * of the module but its own, so that no two operations can clash.
 */
export function renderOperation(operation: ClientOperation): string {
  const prefix = typeName(operation.name);
  const input = isInputOptional(operation) ? `input: ${prefix}Input = {}` : `input: ${prefix}Input`;

  return [
    renderInput(operation),
    renderResult(operation),
    [
      ...docComment(operationDescription(operation), ''),
      `export function ${operation.name}(`,
      '  connection: Connection,',
      `  ${input},`,
      '  options: CallOptions = {},',
      `): Promise<${prefix}Result> {`,
      `  const operation: Operation = ${operationLiteral(operation).replaceAll('\n', '\n  ')};`,
      '',
      `  return send<${prefix}Result>(connection, operation, { ...input, ...options });`,
      '}',
    ].join('\n'),
  ].join('\n\n');
}

function operationLiteral(operation: ClientOperation): string {
  const security = operation.security.map((alternative) => `[${alternative.map(quoted).join(', ')}]`);
  const responses = operation.responses.map((response) => `${response.status}: '${response.read}'`);

  return [
    '{',
    `  method: '${operation.method}',`,
    `  path: ${quoted(operation.path)},`,
    `  security: [${security.join(', ')}],`,
    `  responses: { ${responses.join(', ')} },`,
    '}',
  ].join('\n');
}

function quoted(text: string): string {
  return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}
