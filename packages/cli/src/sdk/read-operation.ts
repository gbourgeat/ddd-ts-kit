import { isRecord } from '../config/values/is-record';
import { toName } from '../naming';
import type { ClientOperation } from './client-operation';
import type { ClientParameter } from './client-parameter';
import { isJson } from './is-json';
import type { OperationPlace } from './operation-place';
import { readResponses } from './read-responses';
import { readSecurity } from './read-security';

export function readOperation(place: OperationPlace, value: unknown): ClientOperation {
  const raw = isRecord(value) ? value : {};
  const own: unknown[] = Array.isArray(raw['parameters']) ? raw['parameters'] : [];

  return {
    name: functionName(raw['operationId'], place),
    method: place.method.toUpperCase(),
    path: place.path,
    summary: typeof raw['summary'] === 'string' ? raw['summary'] : '',
    deprecated: raw['deprecated'] === true,
    security: readSecurity(raw['security'] ?? place.security),
    parameters: parametersOf([...place.shared, ...own]),
    body: bodyOf(raw['requestBody']),
    responses: readResponses(raw['responses']),
  };
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The `operationId` when it is an identifier, its words in camel case otherwise, the method and the path without one. */
function functionName(operationId: unknown, place: OperationPlace): string {
  if (typeof operationId === 'string' && IDENTIFIER.test(operationId)) {
    return operationId;
  }

  const words = typeof operationId === 'string' && operationId !== '' ? operationId : `${place.method} ${place.path}`;
  const camel = toName(words).camel;

  return IDENTIFIER.test(camel) ? camel : `operation${toName(words).pascal}`;
}

/** The parameters of the path item, each replaced by one of the operation with the same name and place. */
function parametersOf(entries: readonly unknown[]): ClientParameter[] {
  const byKey = new Map<string, ClientParameter>();

  for (const entry of entries) {
    const parameter = isRecord(entry) ? parameterOf(entry) : undefined;

    if (parameter !== undefined) {
      byKey.set(`${parameter.in} ${parameter.name}`, parameter);
    }
  }

  return [...byKey.values()];
}

function parameterOf(raw: Record<string, unknown>): ClientParameter | undefined {
  const where = raw['in'];
  const name = raw['name'];

  if (typeof name !== 'string' || (where !== 'path' && where !== 'query' && where !== 'header')) {
    return undefined;
  }

  return {
    name,
    in: where,
    required: where === 'path' || raw['required'] === true,
    schema: raw['schema'],
    description: typeof raw['description'] === 'string' ? raw['description'] : '',
  };
}

/** The schema of a JSON body; a body of another media type is not sent by the client. */
function bodyOf(value: unknown): ClientOperation['body'] {
  const body = isRecord(value) ? value : {};
  const content = isRecord(body['content']) ? body['content'] : {};
  const json = Object.keys(content).find(isJson);
  const media = json === undefined ? undefined : content[json];

  return isRecord(media) ? { schema: media['schema'], required: body['required'] === true } : undefined;
}
