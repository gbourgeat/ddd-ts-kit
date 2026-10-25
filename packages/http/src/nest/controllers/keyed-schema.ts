import { err, ok } from '@ddd-ts-kit/kernel';
import type { Schema, ValidationIssue } from '@ddd-ts-kit/validation';
import { isRecord } from '../../support/is-record';

/**
 * The schema of the parts a method names one by one (`@Param('invoiceId')`): each is a text, the
 * parameters of the path required, the query and the headers optional. Headers are read in lower
 * case, as Node gives them.
 */
export function keyedSchema(keys: readonly string[], required: boolean): Schema<Record<string, string>> {
  const names = [...new Set(keys)];

  return {
    parse(input) {
      const parts = isRecord(input) ? input : {};
      const issues: ValidationIssue[] = [];
      const read: Record<string, string> = {};

      for (const name of names) {
        const value = parts[name];

        if (typeof value === 'string' && value !== '') {
          read[name] = value;
        } else if (value !== undefined || required) {
          issues.push({ path: name, code: 'isString', message: `${name} is a required text.` });
        }
      }

      return issues.length === 0 ? ok(read) : err(issues);
    },
    toJsonSchema: () => ({
      type: 'object',
      properties: Object.fromEntries(names.map((name) => [name, { type: 'string' }])),
      ...(required ? { required: names } : {}),
    }),
  };
}
