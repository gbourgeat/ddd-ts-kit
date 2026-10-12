import type { ClientOperation } from './client-operation.js';
import { docComment } from './doc-comment.js';
import { isInputOptional } from './is-input-optional.js';
import { operationDescription } from './operation-description.js';
import { renderInput } from './render-input.js';
import { renderResult } from './render-result.js';
import { toName } from '../naming/index.js';
import { typeName } from './type-name.js';

/** The types of one operation, what the client knows of it, and its function. */
export function renderOperation(operation: ClientOperation): string {
  const prefix = typeName(operation.name);
  const constant = toName(operation.name).constant;
  const input = isInputOptional(operation) ? `input: ${prefix}Input = {}` : `input: ${prefix}Input`;

  return [
    renderInput(operation),
    renderResult(operation),
    `const ${constant}: Operation = ${operationLiteral(operation)};`,
    [
      ...docComment(operationDescription(operation), ''),
      `export function ${operation.name}(`,
      '  connection: Connection,',
      `  ${input},`,
      '  options: CallOptions = {},',
      `): Promise<${prefix}Result> {`,
      `  return send<${prefix}Result>(connection, ${constant}, { ...input, ...options });`,
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
