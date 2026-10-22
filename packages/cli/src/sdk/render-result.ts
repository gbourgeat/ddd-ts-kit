import type { ClientOperation } from './client-operation';
import type { ClientResponse } from './client-response';
import { SchemaTypes } from './schema-types';
import { typeName } from './type-name';

const TYPES = new SchemaTypes('Schemas.');

/** The type of what a call of an operation answers: one member per status its contract declares. */
export function renderResult(operation: ClientOperation): string {
  const name = `${typeName(operation.name)}Result`;
  const members = operation.responses.map(member);

  return members.length === 0
    ? `export type ${name} = Success<number, unknown>;`
    : `export type ${name} =\n${members.map((line) => `  | ${line}`).join('\n')};`;
}

function member(response: ClientResponse): string {
  const body = bodyType(response);

  if (response.status < 400) {
    return `Success<${response.status}, ${body}>`;
  }

  const codes = response.codes.length === 0 ? 'string' : response.codes.map((code) => `'${code}'`).join(' | ');

  return `Failure<${response.status}, ${codes}, ${body}>`;
}

function bodyType(response: ClientResponse): string {
  if (response.read === 'none') {
    return 'undefined';
  }

  return response.read === 'text' ? 'string' : TYPES.typeOf(response.schema, 1);
}
