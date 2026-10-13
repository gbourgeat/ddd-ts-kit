import type { ClientOperation } from './client-operation.js';
import type { ClientParameter } from './client-parameter.js';
import { docComment } from './doc-comment.js';
import { propertyKey } from './property-key.js';
import { SchemaTypes } from './schema-types.js';
import { typeName } from './type-name.js';

const TYPES = new SchemaTypes('Schemas.');
const PLACES = ['path', 'query', 'header'] as const;

/** The type of what a call of an operation sends: its parameters by place, and its body. */
export function renderInput(operation: ClientOperation): string {
  const name = `${typeName(operation.name)}Input`;
  const members = [...PLACES.flatMap((place) => placeMembers(operation, place)), ...bodyMembers(operation)];

  return members.length === 0
    ? `export type ${name} = Record<string, never>;`
    : `export interface ${name} {\n${members.join('\n')}\n}`;
}

function placeMembers(operation: ClientOperation, place: ClientParameter['in']): string[] {
  const parameters = operation.parameters.filter((parameter) => parameter.in === place);

  if (parameters.length === 0) {
    return [];
  }

  const optional = parameters.every((parameter) => !parameter.required) ? '?' : '';

  const lines = parameters.flatMap((parameter) => [
    ...docComment(parameter.description, '    '),
    `    readonly ${propertyKey(parameter.name)}${parameter.required ? '' : '?'}: ${TYPES.typeOf(parameter.schema, 2)};`,
  ]);

  return [`  readonly ${place}${optional}: {`, ...lines, '  };'];
}

function bodyMembers(operation: ClientOperation): string[] {
  const body = operation.body;

  return body === undefined ? [] : [`  readonly body${body.required ? '' : '?'}: ${TYPES.typeOf(body.schema, 1)};`];
}
