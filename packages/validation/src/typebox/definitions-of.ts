import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { JsonSchema } from '../json-schema';
import { DEFINITIONS_POINTER } from '../shared/definitions-pointer';
import { isRecord } from '../shared/is-record';

type Definitions = Record<string, JsonSchema>;

/** Keywords whose value is data, never a schema: an `$id` written there is a value. */
const VALUE_KEYWORDS = new Set(['default', 'const', 'enum', 'examples']);

/** Keywords whose value maps names to schemas: the names are kept, the schemas are read. */
const SCHEMA_MAPS = new Set(['properties', 'patternProperties', 'dependentSchemas', '$defs']);

/**
 * The JSON Schema of a TypeBox schema, its shared parts moved under `$defs`: a schema built with
 * an `$id` (`Type.Object({...}, { $id: 'Slot' })`) is written once there and referenced wherever
 * it is nested. A schema that has an `$id` itself is a reference to its own definition: shared.
 * Two different schemas under one `$id` are refused: one of them would be documented as the other.
 */
export function definitionsOf(type: unknown): JsonSchema {
  const definitions: Definitions = {};
  const described = movedSchema(type, definitions);
  const root = isRecord(described) ? described : {};
  const names = Object.keys(definitions).sort();

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...root,
    ...(names.length > 0 ? { $defs: Object.fromEntries(names.map((name) => [name, definitions[name]])) } : {}),
  };
}

function movedSchema(node: unknown, definitions: Definitions): unknown {
  if (!isRecord(node)) {
    return node;
  }

  const { $id: id, ...rest } = node;

  const content = Object.fromEntries(
    Object.entries(rest).map(([keyword, value]) => [keyword, movedKeyword(keyword, value, definitions)]),
  );

  if (typeof id !== 'string') {
    return content;
  }

  define(id, content, definitions);

  return { $ref: `${DEFINITIONS_POINTER}${id}` };
}

function movedKeyword(keyword: string, value: unknown, definitions: Definitions): unknown {
  if (VALUE_KEYWORDS.has(keyword)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => movedSchema(item, definitions));
  }

  if (SCHEMA_MAPS.has(keyword) && isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([name, schema]) => [name, movedSchema(schema, definitions)]));
  }

  return movedSchema(value, definitions);
}

function define(id: string, content: JsonSchema, definitions: Definitions): void {
  const known = definitions[id];

  if (known !== undefined && JSON.stringify(known) !== JSON.stringify(content)) {
    throw new DeclarationError(
      `Two different TypeBox schemas are built with the $id "${id}": the contract would document one as the other. Give each its own $id, or build the shared one once and nest it.`,
    );
  }

  definitions[id] = content;
}
