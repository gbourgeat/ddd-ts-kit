import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export function keyName(key: TSESTree.Node): string | undefined {
  if (key.type === AST_NODE_TYPES.PrivateIdentifier) {
    return `#${key.name}`;
  }

  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }

  return key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string' ? key.value : undefined;
}
