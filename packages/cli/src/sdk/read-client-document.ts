import { isRecord } from '../config/values/is-record.js';
import type { ClientDocument } from './client-document.js';
import type { ClientOperation } from './client-operation.js';
import type { DocumentSource } from './document-source.js';
import { readOperation } from './read-operation.js';
import { readSchemes } from './read-schemes.js';
import { operationNames } from './operation-names.js';
import { schemaTypeName } from './schema-type-name.js';

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/** An OpenAPI 3 document, read as what its client needs; what it does not declare is left empty. */
export function readClientDocument(from: DocumentSource, document: unknown): ClientDocument {
  const raw = isRecord(document) ? document : {};
  const info = isRecord(raw['info']) ? raw['info'] : {};
  const components = isRecord(raw['components']) ? raw['components'] : {};
  const schemas = Object.entries(isRecord(components['schemas']) ? components['schemas'] : {});

  return {
    ...from,
    title: typeof info['title'] === 'string' ? info['title'] : from.name,
    version: typeof info['version'] === 'string' ? info['version'] : '0.0.0',
    operations: operationsOf(raw, new Set(schemas.map(([name]) => schemaTypeName(name)))),
    schemas,
    schemes: readSchemes(components['securitySchemes']),
  };
}

/** Every operation, in the order of the paths and of the methods, each named once and apart from the schema types. */
function operationsOf(raw: Record<string, unknown>, schemaTypes: ReadonlySet<string>): ClientOperation[] {
  const paths = isRecord(raw['paths']) ? raw['paths'] : {};
  const security = raw['security'];

  const operations = Object.entries(paths).flatMap(([path, item]) => {
    const methods = isRecord(item) ? item : {};
    const shared = Array.isArray(methods['parameters']) ? methods['parameters'] : [];

    return METHODS.filter((method) => isRecord(methods[method])).map((method) =>
      readOperation({ method, path, shared, security }, methods[method]),
    );
  });

  const names = operationNames(
    operations.map((operation) => operation.name),
    schemaTypes,
  );

  return operations.map((operation, index) => ({ ...operation, name: names[index] ?? operation.name }));
}
