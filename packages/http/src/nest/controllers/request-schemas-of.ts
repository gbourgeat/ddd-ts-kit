import type { Schema } from '@ddd-ts-kit/validation';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { DtoType } from './dto-type';
import { keyedSchema } from './keyed-schema';
import type { NestControllerRoutesOptions } from './nest-controller-routes-options';
import type { NestMethod } from './nest-method';
import type { NestParameter } from './nest-parameter';
import { schemaOf } from './schema-of';

type Source = NestParameter['source'];
type RequestSchemas = Partial<Record<Source, Schema<unknown>>>;

const SOURCES: readonly Source[] = ['params', 'query', 'headers', 'body'];
/** What `emitDecoratorMetadata` records for a parameter that has no class of its own. */
const NO_CLASS: readonly unknown[] = [undefined, Object, String, Number, Boolean, Array];

/**
 * The schemas of the parts of the request: those @KitRoute gives, else the class of a parameter
 * that takes a part whole, else the names its parameters read one by one, each a text.
 */
export function requestSchemasOf(method: NestMethod, options: NestControllerRoutesOptions): RequestSchemas {
  const given = method.spec.request ?? {};

  return Object.fromEntries(
    SOURCES.flatMap((source) => {
      const schema = given[source] ?? derived(method, source, options);

      return schema === undefined ? [] : [[source, schema]];
    }),
  );
}

function derived(
  { where, read }: NestMethod,
  source: Source,
  options: NestControllerRoutesOptions,
): Schema<unknown> | undefined {
  const taking = read.parameters.filter((parameter) => parameter.source === source);
  const whole = taking.find(({ key }) => key === undefined);

  if (whole !== undefined) {
    return schemaOf(where, dtoOf(where, whole), options);
  }

  if (taking.length === 0) {
    return undefined;
  }

  if (source === 'body') {
    throw new DeclarationError(
      `${where}: the body is read one field at a time; type it whole by a DTO class, or give request.body in @KitRoute.`,
    );
  }

  return keyedSchema(keysOf(where, taking), source === 'params');
}

function dtoOf(where: string, { index, source, type }: NestParameter): DtoType {
  if (NO_CLASS.includes(type) || !isDto(type)) {
    throw new DeclarationError(
      `${where}: parameter ${String(index)} takes the whole ${source} and has no class: type it by a DTO class, compiled with emitDecoratorMetadata, or give request.${source} in @KitRoute.`,
    );
  }

  return type;
}

function keysOf(where: string, taking: readonly NestParameter[]): string[] {
  return taking.flatMap(({ index, source, key, type }) => {
    if (type !== undefined && type !== String) {
      throw new DeclarationError(
        `${where}: parameter ${String(index)} is one ${source} part, a text; a number or a date is read by a DTO class of the whole ${source}.`,
      );
    }

    return key === undefined ? [] : [source === 'headers' ? key.toLowerCase() : key];
  });
}

function isDto(type: unknown): type is DtoType {
  return typeof type === 'function' && 'prototype' in type;
}
