import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { expressionRole } from './entry-role.js';

type PropertyValue = TSESTree.Property['value'];

type NotAnExpression =
  | TSESTree.AssignmentPattern
  | TSESTree.ArrayPattern
  | TSESTree.ObjectPattern
  | TSESTree.TSEmptyBodyFunctionExpression;

/**
 * Whether an object literal answered by a function is a value of the model written as a record:
 * it holds data (an entry that is not a function), nothing a call or `new` of the model built,
 * and no spread. A record of value objects the function builds (`{ first: Money.of(1), rest }`)
 * is an operation of the model; a spread (`{ ...state, status }`) derives a record that exists;
 * an object of functions only is behaviour, a specification or a strategy.
 */
export function standsForAValue(object: TSESTree.ObjectExpression, program: TSESTree.Program): boolean {
  const roles = object.properties.map((property) => {
    if (property.type === AST_NODE_TYPES.SpreadElement) {
      return 'spread';
    }

    return property.method || property.kind !== 'init' ? 'behaviour' : valueRole(property.value, program);
  });

  return roles.includes('data') && !roles.includes('built') && !roles.includes('spread');
}

function valueRole(value: PropertyValue, program: TSESTree.Program): string {
  if (isNotAnExpression(value)) {
    return value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression ? 'behaviour' : 'data';
  }

  return expressionRole(value, program);
}

function isNotAnExpression(value: PropertyValue): value is NotAnExpression {
  return (
    value.type === AST_NODE_TYPES.AssignmentPattern ||
    value.type === AST_NODE_TYPES.ArrayPattern ||
    value.type === AST_NODE_TYPES.ObjectPattern ||
    value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
  );
}
