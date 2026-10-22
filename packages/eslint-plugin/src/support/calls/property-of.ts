import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { keyName } from '../classes/key-name';

export function propertyOf(object: TSESTree.ObjectExpression, key: string): TSESTree.Property | undefined {
  return object.properties
    .filter((property) => property.type === AST_NODE_TYPES.Property)
    .find((property) => !property.computed && keyName(property.key) === key);
}
