import { err, ok, type Result } from '@ddd-ts-kit/kernel';
import {
  customSchema,
  sharedNameOf,
  sharedSchema,
  type JsonSchema,
  type Schema,
  type ValidationIssue,
} from '@ddd-ts-kit/validation';
import { isRecord } from '../support/is-record.js';
import { issue } from './issue.js';
import type { PageBody } from './page-body.js';

/**
 * The schema of a page of items, from the schema of one item: validates the envelope and each
 * item, and describes both in the contract. Local `$defs` of the item schema move to the top,
 * where the OpenAPI generator collects them. The page of a shared item is shared too, as
 * `<Item>Page`: every search that answers pages of it points at one component.
 */
export function pageSchemaOf<T>(item: Schema<T>): Schema<PageBody<T>> {
  const itemJsonSchema = item.toJsonSchema();
  const page = customSchema((input) => parsePageBody(input, item), pageJsonSchema(itemJsonSchema));
  const shared = sharedNameOf(itemJsonSchema);

  return shared === undefined ? page : sharedSchema(`${shared}Page`, page);
}

function parsePageBody<T>(input: unknown, item: Schema<T>): Result<PageBody<T>, ValidationIssue[]> {
  if (!isRecord(input) || !Array.isArray(input['items'])) {
    return err([issue('items', 'invalid_page', 'A page has a list of items.')]);
  }

  const issues: ValidationIssue[] = [];
  const items = itemsOf(input['items'], item, issues);
  const more = moreOf(input, issues);

  return issues.length > 0 ? err(issues) : ok({ items, ...more });
}

function itemsOf<T>(inputs: readonly unknown[], item: Schema<T>, issues: ValidationIssue[]): T[] {
  return inputs.flatMap((input, index) => {
    const parsed = item.parse(input);

    if (parsed.ok) {
      return [parsed.value];
    }

    for (const found of parsed.error) {
      const path = found.path === '' ? `items.${String(index)}` : `items.${String(index)}.${found.path}`;

      issues.push({ ...found, path });
    }

    return [];
  });
}

function moreOf(input: Record<string, unknown>, issues: ValidationIssue[]): Omit<PageBody<never>, 'items'> {
  const { total, nextCursor } = input;
  const counted = typeof total === 'number' && Number.isSafeInteger(total) && total >= 0;

  if (total !== undefined && !counted) {
    issues.push(issue('total', 'invalid_page', 'Must be a non-negative integer.'));
  }

  if (nextCursor !== undefined && typeof nextCursor !== 'string') {
    issues.push(issue('nextCursor', 'invalid_page', 'Must be a string.'));
  }

  return { ...(counted ? { total } : {}), ...(typeof nextCursor === 'string' ? { nextCursor } : {}) };
}

function pageJsonSchema(itemSchema: JsonSchema): JsonSchema {
  const { $schema: _dialect, $defs, definitions, ...item } = itemSchema;

  return {
    type: 'object',
    required: ['items'],
    properties: {
      items: { type: 'array', items: item },
      total: { type: 'integer', minimum: 0, description: 'Present when it is cheap to count.' },
      nextCursor: { type: 'string', description: 'Present when more items follow.' },
    },
    ...($defs === undefined ? {} : { $defs }),
    ...(definitions === undefined ? {} : { definitions }),
  };
}
