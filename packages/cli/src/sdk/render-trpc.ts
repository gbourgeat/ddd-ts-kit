import { renderTemplate } from '../templating';
import type { ClientDocument } from './client-document';
import type { ClientOperation } from './client-operation';
import { docComment } from './doc-comment';
import { generatedHeader } from './generated-header';
import { isInputOptional } from './is-input-optional';
import { operationDescription } from './operation-description';
import { propertyKey } from './property-key';
import { schemaTypeName } from './schema-type-name';
import { typeName } from './type-name';

const PROBLEM = 'Problem';

/**
 * `trpc.ts`: the type of the router the API serves under /trpc, one procedure per operation that
 * receives JSON, named by its `operationId`, a query for a `GET` and a mutation for the others;
 * its input and its body are the types of the HTTP client. tRPC types no refusal per procedure:
 * the problem document of each is in `data.problem`.
 */
export function renderTrpc(document: ClientDocument): string {
  const procedures = document.operations.filter((operation) => operation.procedure !== undefined);
  const schemas = document.schemas.some(([name]) => name === PROBLEM);

  return renderTemplate('sdk/trpc.ts.tpl', {
    header: generatedHeader(document),
    schemas,
    problem: schemas ? `Schemas.${schemaTypeName(PROBLEM)}` : 'unknown',
    api: `${document.title} ${document.version}`,
    procedures: procedures.map(procedure).join('\n'),
  });
}

function procedure(operation: ClientOperation): string {
  const prefix = `Operations.${typeName(operation.name)}`;
  const input = isInputOptional(operation) ? `${prefix}Input | undefined` : `${prefix}Input`;
  const kind = operation.method === 'GET' ? 'TRPCQueryProcedure' : 'TRPCMutationProcedure';

  return [
    ...docComment(operationDescription(operation), '    '),
    `    ${propertyKey(operation.procedure ?? operation.name)}: ${kind}<Procedure<${input}, DataOf<${prefix}Result>>>;`,
  ].join('\n');
}
