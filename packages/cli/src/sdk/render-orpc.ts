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
 * `orpc.ts`: the oRPC contract of the procedures the API serves under /rpc, one per operation that
 * receives JSON, named by its `operationId`; its input and its body are the types of the HTTP
 * client, its refusals the codes of the contract with their status, a problem document as data.
 */
export function renderOrpc(document: ClientDocument): string {
  const procedures = document.operations.filter((operation) => operation.procedure !== undefined);
  const schemas = document.schemas.some(([name]) => name === PROBLEM);

  return renderTemplate('sdk/orpc.ts.tpl', {
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

  const errors = refusals(operation).map(
    ([code, status]) => `      ${propertyKey(code)}: { status: ${status}, data: type<Problem>() },`,
  );

  return [
    ...docComment(operationDescription(operation), '  '),
    `  ${propertyKey(operation.procedure ?? operation.name)}: oc`,
    ...(errors.length === 0 ? [] : ['    .errors({', ...errors, '    })']),
    `    .input(type<${input}>())`,
    `    .output(type<DataOf<${prefix}Result>>()),`,
  ].join('\n');
}

/** Each code a refusal of the operation may carry, with the status the contract gives it. */
function refusals(operation: ClientOperation): (readonly [string, number])[] {
  return operation.responses.flatMap((response) => response.codes.map((code) => [code, response.status] as const));
}
