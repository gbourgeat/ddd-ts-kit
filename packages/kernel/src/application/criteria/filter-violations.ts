import type { CriteriaDefinition } from './criteria-definition.js';
import type { CriteriaViolation, CriteriaViolationCode } from './criteria-violation.js';
import type { FieldDeclaration } from './field-declaration.js';
import type { FilterCondition, FilterNode } from './filter-node.js';
import { isValueOf } from './is-value-of.js';

export function filterViolations<Row>(
  definition: CriteriaDefinition<Row>,
  filters: readonly FilterNode[],
): CriteriaViolation[] {
  const { maxFilters } = definition.limits;
  const violations = filters.flatMap((node) => nodeViolations(definition, node, 1));

  if (conditionsIn(filters) > maxFilters) {
    violations.push(violation('filter', 'too_many_filters', `A read holds ${String(maxFilters)} conditions at most.`));
  }

  return violations;
}

function nodeViolations<Row>(
  definition: CriteriaDefinition<Row>,
  node: FilterNode,
  depth: number,
): CriteriaViolation[] {
  const { maxDepth } = definition.limits;

  if (node.kind === 'condition') {
    return conditionViolations(definition, node);
  }

  if (depth > maxDepth) {
    return [violation('filter', 'too_deep', `Groups nest ${String(maxDepth)} deep at most.`)];
  }

  if (node.filters.length === 0) {
    return [violation('filter', 'empty_group', 'A group holds one filter at least.')];
  }

  return node.filters.flatMap((inner) => nodeViolations(definition, inner, depth + 1));
}

function conditionViolations<Row>(
  definition: CriteriaDefinition<Row>,
  condition: FilterCondition,
): CriteriaViolation[] {
  const { field, operator } = condition;
  const path = `filter.${field}`;
  const declared = Object.hasOwn(definition.fields, field) ? definition.fields[field] : undefined;

  if (declared === undefined) {
    return [violation(path, 'unknown_field', 'This field cannot be filtered.')];
  }

  if (!declared.filter.includes(operator)) {
    return [
      violation(path, 'operator_not_allowed', `Operators of this field: ${declared.filter.join(', ') || 'none'}.`),
    ];
  }

  const code = operandDefect(declared, condition, definition.limits.maxInList);

  return code === undefined ? [] : [violation(path, code, messageOf(code, definition))];
}

function operandDefect(
  declared: FieldDeclaration,
  { operator, value }: FilterCondition,
  maxInList: number,
): CriteriaViolationCode | undefined {
  const fits = (operand: unknown): boolean => isValueOf(declared.type, operand);

  if (operator === 'in') {
    return listDefect(value, fits, maxInList);
  }

  return operandFits(operator, value, fits) ? undefined : 'invalid_value';
}

function operandFits(
  operator: FilterCondition['operator'],
  value: unknown,
  fits: (operand: unknown) => boolean,
): boolean {
  switch (operator) {
    case 'isNull':
      return typeof value === 'boolean';
    case 'contains':
    case 'startsWith':
      return typeof value === 'string' && value !== '';
    case 'between':
      return Array.isArray(value) && value.length === 2 && value.every(fits);
    default:
      return fits(value);
  }
}

function listDefect(
  value: unknown,
  fits: (operand: unknown) => boolean,
  maxInList: number,
): CriteriaViolationCode | undefined {
  if (!Array.isArray(value) || value.length === 0 || !value.every(fits)) {
    return 'invalid_value';
  }

  return value.length > maxInList ? 'in_list_too_long' : undefined;
}

function messageOf<Row>(code: CriteriaViolationCode, definition: CriteriaDefinition<Row>): string {
  return code === 'in_list_too_long'
    ? `A list holds ${String(definition.limits.maxInList)} values at most.`
    : 'The value does not fit the type of this field or its operator.';
}

function conditionsIn(filters: readonly FilterNode[]): number {
  return filters.reduce((count, node) => count + (node.kind === 'condition' ? 1 : conditionsIn(node.filters)), 0);
}

function violation(path: string, code: CriteriaViolationCode, message: string): CriteriaViolation {
  return { path, code, message };
}
