import { defaultMetadataStorage } from 'class-transformer/cjs/storage.js';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import type { JsonSchema } from '../json-schema.js';

type SchemasByName = Record<string, JsonSchema>;

const DEFS_POINTER = '#/$defs/';

/** The JSON Schema of a class, carrying under `$defs` only the classes reachable from it. */
export function selfContainedSchema(className: string): JsonSchema {
  const all = generatedSchemas();
  const own = all[className] ?? { type: 'object' };
  const defs: SchemasByName = {};

  collectDefs(own, all, defs);

  const names = Object.keys(defs).sort();

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...own,
    ...(names.length > 0
      ? { $defs: Object.fromEntries(names.map((name) => [name, defs[name]])) }
      : {}),
  };
}

function generatedSchemas(): SchemasByName {
  const generated = validationMetadatasToSchemas({
    classTransformerMetadataStorage: defaultMetadataStorage,
    refPointerPrefix: DEFS_POINTER,
  });

  return Object.fromEntries(
    Object.entries(generated).map(([name, schema]) => [name, { ...schema }]),
  );
}

function collectDefs(node: unknown, all: SchemasByName, defs: SchemasByName): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectDefs(item, all, defs);
    }

    return;
  }

  if (typeof node !== 'object' || node === null) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    const name = referencedDefinition(key, value);

    if (name === undefined) {
      collectDefs(value, all, defs);
    } else {
      collectDefinition(name, all, defs);
    }
  }
}

function referencedDefinition(key: string, value: unknown): string | undefined {
  if (key === '$ref' && typeof value === 'string' && value.startsWith(DEFS_POINTER)) {
    return value.slice(DEFS_POINTER.length);
  }

  return undefined;
}

function collectDefinition(name: string, all: SchemasByName, defs: SchemasByName): void {
  const target = all[name];

  // The root is carried too when a nested class points back at it.
  if (target !== undefined && defs[name] === undefined) {
    defs[name] = target;
    collectDefs(target, all, defs);
  }
}
