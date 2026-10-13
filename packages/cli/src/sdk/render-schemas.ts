import { isRecord } from '../config/values/is-record.js';
import type { ClientDocument } from './client-document.js';
import { docComment } from './doc-comment.js';
import { generatedHeader } from './generated-header.js';
import { SchemaTypes } from './schema-types.js';
import { schemaTypeName } from './schema-type-name.js';

/** `schemas.ts`: one type per schema of `components.schemas`. */
export function renderSchemas(document: ClientDocument): string {
  const types = new SchemaTypes('');

  const declarations = document.schemas.map(([name, schema]) =>
    [
      ...docComment(isRecord(schema) ? schema['description'] : undefined, ''),
      `export type ${schemaTypeName(name)} = ${types.typeOf(schema, 0)};`,
    ].join('\n'),
  );

  return `${[generatedHeader(document), ...(declarations.length === 0 ? ['export {};'] : declarations)].join('\n\n')}\n`;
}
