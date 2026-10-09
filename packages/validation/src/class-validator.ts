import 'reflect-metadata';
import { plainToInstance, type ClassTransformOptions } from 'class-transformer';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage.js';
import {
  validateSync,
  type ValidationError as ClassValidatorError,
  type ValidatorOptions,
} from 'class-validator';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { err, ok } from '@ddd-ts-kit/kernel';
import type { JsonSchema, Schema, ValidationIssue } from './index.js';

export type DtoClass<T extends object> = new () => T;

export interface ClassSchemaOptions {
  /** Merged over the defaults `{ whitelist: true, forbidNonWhitelisted: true }`. */
  readonly validator?: ValidatorOptions;
  readonly transform?: ClassTransformOptions;
}

const DEFS_POINTER = '#/$defs/';

export function classSchema<T extends object>(
  dto: DtoClass<T>,
  options: ClassSchemaOptions = {},
): Schema<T> {
  const validatorOptions: ValidatorOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
    ...options.validator,
  };

  return {
    parse(input) {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return err([{ path: '', code: 'isObject', message: 'An object is expected.' }]);
      }
      const instance = plainToInstance(dto, input, options.transform);
      const errors = validateSync(instance, validatorOptions);
      return errors.length === 0 ? ok(instance) : err(flatten(errors, ''));
    },
    toJsonSchema: () => selfContainedSchema(dto.name),
  };
}

function flatten(errors: readonly ClassValidatorError[], parent: string): ValidationIssue[] {
  return errors.flatMap((error) => {
    const path = parent === '' ? error.property : `${parent}.${error.property}`;
    const own = Object.entries(error.constraints ?? {}).map(([code, message]) => ({
      path,
      code,
      message,
    }));
    return [...own, ...flatten(error.children ?? [], path)];
  });
}

function selfContainedSchema(className: string): JsonSchema {
  const all = generatedSchemas();
  const own = all[className] ?? { type: 'object' };
  const defs: Record<string, JsonSchema> = {};
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

function generatedSchemas(): Record<string, JsonSchema> {
  const generated = validationMetadatasToSchemas({
    classTransformerMetadataStorage: defaultMetadataStorage,
    refPointerPrefix: DEFS_POINTER,
  });
  return Object.fromEntries(
    Object.entries(generated).map(([name, schema]) => [name, { ...schema }]),
  );
}

/** Carries only the definitions reachable from the class, so the schema is self-contained. */
function collectDefs(
  node: unknown,
  all: Record<string, JsonSchema>,
  defs: Record<string, JsonSchema>,
): void {
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

function collectDefinition(
  name: string,
  all: Record<string, JsonSchema>,
  defs: Record<string, JsonSchema>,
): void {
  const target = all[name];
  // The root is carried too when a nested class points back at it.
  if (target !== undefined && defs[name] === undefined) {
    defs[name] = target;
    collectDefs(target, all, defs);
  }
}
