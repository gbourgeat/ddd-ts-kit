import { defaultMetadataStorage } from 'class-transformer/cjs/storage.js';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import type { JsonSchema } from '../json-schema.js';
import { DEFINITIONS_POINTER } from '../shared/definitions-pointer.js';
import type { DtoClass } from './dto-class.js';

type SchemasByName = Record<string, JsonSchema>;

/**
 * The JSON Schema of a class, carrying under `$defs` only the classes reachable from it. Shared,
 * the class itself is one of them and the schema is a reference to it.
 */
export function selfContainedSchema(dto: DtoClass<object>, shared: boolean): JsonSchema {
  const all = generatedSchemas();
  const own = ownSchema(dto, all);
  const defs: SchemasByName = shared ? { [dto.name]: own } : {};

  collectDefs(own, all, defs);

  const names = Object.keys(defs).sort();

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...(shared ? { $ref: `${DEFINITIONS_POINTER}${dto.name}` } : own),
    ...(names.length > 0 ? { $defs: Object.fromEntries(names.map((name) => [name, defs[name]])) } : {}),
  };
}

function generatedSchemas(): SchemasByName {
  const generated = validationMetadatasToSchemas({
    classTransformerMetadataStorage: defaultMetadataStorage,
    refPointerPrefix: DEFINITIONS_POINTER,
  });

  return Object.fromEntries(Object.entries(generated).map(([name, schema]) => [name, { ...schema }]));
}

/** A class that declares nothing itself (`class Body extends pickClass(...) {}`) is described by its nearest described ancestor. */
function ownSchema(dto: DtoClass<object>, all: SchemasByName): JsonSchema {
  let ancestor: unknown = dto;

  while (typeof ancestor === 'function' && ancestor.name !== '') {
    const described = all[ancestor.name];

    if (described !== undefined) {
      return described;
    }

    ancestor = Object.getPrototypeOf(ancestor);
  }

  return { type: 'object' };
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
  if (key === '$ref' && typeof value === 'string' && value.startsWith(DEFINITIONS_POINTER)) {
    return value.slice(DEFINITIONS_POINTER.length);
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
