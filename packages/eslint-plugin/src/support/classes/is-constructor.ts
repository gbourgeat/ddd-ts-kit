import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export function isConstructor(member: TSESTree.ClassElement): member is TSESTree.MethodDefinition {
  return member.type === AST_NODE_TYPES.MethodDefinition && member.kind === 'constructor';
}
