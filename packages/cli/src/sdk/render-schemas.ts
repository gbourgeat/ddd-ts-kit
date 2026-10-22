import { isRecord } from '../config/values/is-record';
import type { ClientDocument } from './client-document';
import { docComment } from './doc-comment';
import { generatedHeader } from './generated-header';
import { SchemaTypes } from './schema-types';
import { schemaTypeName } from './schema-type-name';

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
