import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { JsonSchema } from '../json-schema.js';
import type { Schema } from '../schema.js';
import { DEFINITIONS_POINTER } from './definitions-pointer.js';
import { isRecord } from './is-record.js';
import { schemaBehind } from './schema-behind.js';
import { sharedNameOf } from './shared-name-of.js';

/** What OpenAPI accepts as the key of a component, starting with a letter. */
const COMPONENT_NAME = /^[A-Za-z][A-Za-z0-9._-]*$/;

/**
 * A schema documented once, under `name`: its JSON Schema becomes a reference to its own
 * definition, so the OpenAPI generator writes it in `components.schemas` and every route that
 * uses it, whole or inside another schema, points at it with `$ref` instead of a copy.
 * Validation is unchanged: `parse` is the one of the schema given, and what another package
 * attached to that schema holds for the shared one too (`schemaBehind`).
 */
export function sharedSchema<T>(name: string, schema: Schema<T>): Schema<T> {
  if (!COMPONENT_NAME.test(name)) {
    throw new DeclarationError(
      `"${name}" cannot name a shared schema: a name starts with a letter and holds only letters, digits, ".", "-" and "_", as an OpenAPI component does.`,
    );
  }

  const shared: Schema<T> = {
    parse: (input) => schema.parse(input),
    toJsonSchema: () => asShared(name, schema.toJsonSchema()),
  };

  schemaBehind.record(shared, schema);

  return shared;
}

function asShared(name: string, jsonSchema: JsonSchema): JsonSchema {
  if (sharedNameOf(jsonSchema) === name) {
    return jsonSchema;
  }

  const { $schema: dialect, $defs, definitions, ...own } = jsonSchema;

  return {
    ...(dialect === undefined ? {} : { $schema: dialect }),
    $ref: `${DEFINITIONS_POINTER}${name}`,
    $defs: { ...recordOf(definitions), ...recordOf($defs), [name]: own },
  };
}

function recordOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
