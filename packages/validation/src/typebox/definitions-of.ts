import type { JsonSchema } from '../json-schema.js';
import { DEFINITIONS_POINTER } from '../shared/definitions-pointer.js';
import { isRecord } from '../shared/is-record.js';

type Definitions = Record<string, JsonSchema>;

/**
 * The JSON Schema of a TypeBox schema, its shared parts moved under `$defs`: a schema built with
 * an `$id` (`Type.Object({...}, { $id: 'Slot' })`) is written once there and referenced wherever
 * it is nested. A schema that has an `$id` itself is a reference to its own definition: shared.
 */
export function definitionsOf(type: unknown): JsonSchema {
  const definitions: Definitions = {};
  const described = moved(type, definitions);
  const root = isRecord(described) ? described : {};
  const names = Object.keys(definitions).sort();

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...root,
    ...(names.length > 0 ? { $defs: Object.fromEntries(names.map((name) => [name, definitions[name]])) } : {}),
  };
}

function moved(node: unknown, definitions: Definitions): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => moved(item, definitions));
  }

  if (!isRecord(node)) {
    return node;
  }

  const { $id: id, ...rest } = node;
  const content = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, moved(value, definitions)]));

  if (typeof id !== 'string') {
    return content;
  }

  definitions[id] = content;

  return { $ref: `${DEFINITIONS_POINTER}${id}` };
}
