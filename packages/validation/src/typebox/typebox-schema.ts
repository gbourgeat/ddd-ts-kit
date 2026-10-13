import type { Static, TSchema } from 'typebox';
import { Compile } from 'typebox/compile';
import { Value } from 'typebox/value';
import { err, ok } from '@ddd-ts-kit/kernel';
import { formatPath } from '../format-path.js';
import { isRecord } from '../shared/is-record.js';
import type { Schema } from '../schema.js';
import type { ValidationIssue } from '../validation-issue.js';
import { definitionsOf } from './definitions-of.js';
import type { TypeboxSchemaOptions } from './typebox-schema-options.js';

interface TypeBoxError {
  readonly keyword: string;
  readonly instancePath: string;
  readonly params: unknown;
  readonly message: string;
}

/**
 * Validates with a TypeBox schema, compiled once. Like zod, it fills the defaults and drops the
 * properties the schema does not declare before checking; the issue code is the JSON Schema
 * keyword that failed (`required`, `format`, `minLength`...). The contract is the schema itself,
 * TypeBox being JSON Schema.
 */
export function typeboxSchema<T extends TSchema>(type: T, options: TypeboxSchemaOptions = {}): Schema<Static<T>> {
  const validator = Compile(type);

  return {
    parse(input) {
      const defaulted = validator.Default(Value.Clone(input));
      const cleaned = validator.Clean(options.coerce === true ? validator.Convert(defaulted) : defaulted);

      if (validator.Check(cleaned)) {
        return ok(cleaned);
      }

      return err(validator.Errors(cleaned).flatMap(issuesOf));
    },
    toJsonSchema: () => definitionsOf(type),
  };
}

/**
 * One issue per failed keyword at its path; a missing property is reported by TypeBox on the
 * object that lacks it, so each missing name becomes an issue at its own path, as zod reports it.
 */
function issuesOf({ keyword, instancePath, params, message }: TypeBoxError): ValidationIssue[] {
  const segments = instancePath
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));

  const missing = keyword === 'required' ? requiredPropertiesOf(params) : [];

  if (missing.length === 0) {
    return [{ path: formatPath(segments), code: keyword, message }];
  }

  return missing.map((name) => ({
    path: formatPath([...segments, name]),
    code: keyword,
    message: `must have required property ${name}`,
  }));
}

function requiredPropertiesOf(params: unknown): string[] {
  const names = isRecord(params) ? params['requiredProperties'] : undefined;

  return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string') : [];
}
