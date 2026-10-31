import type { ClientDocument } from './client-document';
import type { ClientOperation } from './client-operation';
import { generatedHeader } from './generated-header';
import { isInputOptional } from './is-input-optional';
import { operationDescription } from './operation-description';
import { docComment } from './doc-comment';
import { typeName } from './type-name';

const IMPORTS = [
  "import * as operations from './operations.js';",
  "import { type CallOptions, type ClientOptions, type Connection, openConnection, type SchemeCarrier } from './runtime.js';",
].join('\n');

/** `client.ts`: the security schemes of the contract, and `createClient`, every operation as a method. */
export function renderClient(document: ClientDocument): string {
  const names = document.schemes.map(([name]) => `'${name}'`);
  const schemes = document.schemes.map(([name, carrier]) => `  '${name}': ${JSON.stringify(carrier)},`);

  return `${generatedHeader(document)}
${IMPORTS}

/** The security schemes of the contract: what \`credentials\` may hold. */
export type SchemeName = ${names.length === 0 ? 'never' : names.join(' | ')};

const SCHEMES: Readonly<Record<SchemeName, SchemeCarrier>> = {${schemes.length === 0 ? '' : `\n${schemes.join('\n')}\n`}};

/** What the functions of \`operations\` are called with, for a bundle that imports only the operations it calls. */
export function connect(options: ClientOptions<SchemeName>): Connection {
  return openConnection(options, SCHEMES);
}

${docComment(`${document.title} ${document.version}, every operation of its contract as a method.`, '').join('\n')}
export interface Client {
${document.operations.map(method).join('\n')}
}

export function createClient(options: ClientOptions<SchemeName>): Client {
  const connection = connect(options);

  return {
${document.operations.map((operation) => `    ${operation.name}: (input, call) => operations.${operation.name}(connection, input, call),`).join('\n')}
  };
}
`;
}

function method(operation: ClientOperation): string {
  const prefix = `operations.${typeName(operation.name)}`;
  const input = `input${isInputOptional(operation) ? '?' : ''}: ${prefix}Input`;

  return [
    ...docComment(operationDescription(operation), '  '),
    `  ${operation.name}(${input}, options?: CallOptions): Promise<${prefix}Result>;`,
  ].join('\n');
}
