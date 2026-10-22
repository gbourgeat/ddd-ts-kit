import type { CriteriaDefinition, FieldDeclaration } from '@ddd-ts-kit/kernel';
import type { JsonSchema } from '@ddd-ts-kit/validation';
import { pageRequestParameters } from '../pagination/page-request-parameters';
import { isRecord } from '../support/is-record';
import { sortableFields } from './sortable-fields';

const WRITTEN: Readonly<Record<FieldDeclaration['type'], string>> = {
  string: 'text',
  number: 'a number',
  boolean: '`true` or `false`',
  instant: 'an ISO 8601 instant with its zone',
  decimal: 'a decimal number',
};

/**
 * The query parameters of a criteria as a JSON Schema object, one OpenAPI parameter per
 * property: a `filter[<field>]` for each field that can be filtered, its operators in the
 * description and in `x-filter-operators`, its type in `x-filter-type`; `sort` as the list of
 * the values it accepts; `limit`, `offset` and `cursor` as `pageRequestParameters` gives them.
 */
export function criteriaParameters<Row>(definition: CriteriaDefinition<Row>): JsonSchema {
  const { defaultPageSize, maxPageSize } = definition.limits;
  const page: unknown = pageRequestParameters({ defaultSize: defaultPageSize, maxSize: maxPageSize })['properties'];

  const filters = Object.entries(definition.fields).flatMap(([field, declared]) =>
    declared.filter.length === 0 ? [] : [[`filter[${field}]`, filterParameter(field, declared)]],
  );

  return {
    type: 'object',
    properties: {
      ...Object.fromEntries(filters),
      sort: sortParameter(sortableFields(definition)),
      ...(isRecord(page) ? page : {}),
    },
  };
}

function filterParameter(field: string, { type, filter }: FieldDeclaration): JsonSchema {
  return {
    type: 'string',
    description: `Filters on \`${field}\`, written \`<operator>:<value>\`; the value alone means \`eq\`. Operators: ${filter.join(', ')}. The value is ${WRITTEN[type]}.`,
    'x-filter-operators': [...filter],
    'x-filter-type': type,
  };
}

function sortParameter(sortable: readonly string[]): JsonSchema {
  return {
    type: 'array',
    items: { type: 'string', enum: sortable.flatMap((field) => [field, `-${field}`]) },
    description: 'The fields to sort by, a leading "-" for descending, repeated or separated by commas.',
  };
}
