import { CriteriaDefinitionError } from './criteria-definition-error.js';
import type { FieldDeclaration } from './field-declaration.js';
import type { FieldType } from './field-type.js';
import type { FilterOperator } from './filter-operator.js';
import { operatorsOfType } from './operators-of-type.js';

const TYPES: readonly FieldType[] = ['string', 'number', 'boolean', 'instant', 'decimal'];

/** The rule of one field as written, checked and completed. */
export function fieldDeclarationOf(field: string, rule: unknown): FieldDeclaration {
  if (typeof rule !== 'object' || rule === null) throw unreadable(field, 'has no rule');

  const type = typeOf(field, rule);
  const nullable = 'nullable' in rule && rule.nullable === true;
  const filter = operatorsOf(rule).map((operator) => allowed(field, type, operator));

  if (filter.includes('isNull') && !nullable) throw unreadable(field, 'declares isNull and is not declared nullable');

  return Object.freeze({ type, filter: Object.freeze(filter), sortable: 'sortable' in rule && rule.sortable === true, nullable });
}

function typeOf(field: string, rule: object): FieldType {
  const declared: unknown = 'type' in rule ? rule.type : undefined;
  const type = TYPES.find((known) => known === declared);

  if (type === undefined) throw unreadable(field, `has a type that is none of ${TYPES.join(', ')}`);

  return type;
}

function operatorsOf(rule: object): readonly unknown[] {
  const filter: unknown = 'filter' in rule ? rule.filter : undefined;

  return Array.isArray(filter) ? filter : [];
}

function allowed(field: string, type: FieldType, operator: unknown): FilterOperator {
  const known = operatorsOfType(type).find((candidate) => candidate === operator);

  if (known === undefined) throw unreadable(field, `is a ${type} and declares an operator that does not apply to it`);

  return known;
}

function unreadable(field: string, complaint: string): CriteriaDefinitionError {
  return new CriteriaDefinitionError(`The field "${field}" of a criteria definition ${complaint}.`);
}
