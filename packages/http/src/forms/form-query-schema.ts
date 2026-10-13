import { err, ok } from '@ddd-ts-kit/kernel';
import { customSchema, type JsonSchema, type Schema, type ValidationIssue } from '@ddd-ts-kit/validation';
import type { SchemaNode } from '../schema/schema-node.js';
import { isRecord } from '../support/is-record.js';
import { FormFormat } from './form-format.js';
import type { FormQuery } from './form-query.js';

const FORMATS: readonly string[] = Object.values(FormFormat);

/**
 * `?format=blocks&calendarId=c-1`: the format (`json-forms` by default) and the value of any
 * scalar field of the body known in advance. The values prefill the form and name the element a
 * field rule is asked about; a number or a boolean is read as the schema types it.
 */
export function formQuerySchema(body: SchemaNode): Schema<FormQuery> {
  const scalars = new Map(body.properties().filter(([, node]) => node.isScalar()));

  return customSchema((input) => {
    const issues: ValidationIssue[] = [];
    const { format = FormFormat.jsonForms, ...given } = isRecord(input) ? input : {};

    if (typeof format !== 'string' || !FORMATS.includes(format)) {
      issues.push({ path: 'format', code: 'invalid_format', message: `One of ${FORMATS.join(', ')}.` });
    }

    const values = Object.fromEntries(
      Object.entries(given).flatMap(([name, value]) => {
        const node = scalars.get(name);

        if (node === undefined || typeof value !== 'string') {
          issues.push({ path: name, code: 'unknown_field', message: 'Not a field of the form known in advance.' });

          return [];
        }

        return [[name, typed(value, node)]];
      }),
    );

    return issues.length > 0
      ? err(issues)
      : ok({ format: format === FormFormat.blocks ? FormFormat.blocks : FormFormat.jsonForms, values });
  }, querySchema(scalars));
}

function typed(value: string, node: SchemaNode): unknown {
  const type = node.type();

  if ((type === 'number' || type === 'integer') && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return type === 'boolean' && (value === 'true' || value === 'false') ? value === 'true' : value;
}

function querySchema(scalars: ReadonlyMap<string, SchemaNode>): JsonSchema {
  return {
    type: 'object',
    properties: {
      format: {
        enum: FORMATS,
        default: FormFormat.jsonForms,
        description: 'JSON Forms (schema, UI schema, data), or the neutral tree of blocks.',
      },
      ...Object.fromEntries(
        [...scalars.keys()].map((name) => [
          name,
          {
            type: 'string',
            description: `A value of ${name} known in advance: it prefills the form and names the element its rules are asked about.`,
          },
        ]),
      ),
    },
  };
}
