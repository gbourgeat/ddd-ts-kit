import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

type Keyed = TSESTree.MethodDefinition | TSESTree.PropertyDefinition | TSESTree.AccessorProperty | TSESTree.TSAbstractMethodDefinition | TSESTree.TSAbstractPropertyDefinition | TSESTree.TSAbstractAccessorProperty;

export function isKeyed(member: TSESTree.ClassElement): member is Keyed {
  return member.type !== AST_NODE_TYPES.StaticBlock && member.type !== AST_NODE_TYPES.TSIndexSignature;
}
