import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/** Whether a class extends `EventSourcedAggregate` of the kernel, with or without type arguments. */
export function isEventSourcedClass(node: TSESTree.Node | undefined): boolean {
  return (
    (node?.type === AST_NODE_TYPES.ClassDeclaration || node?.type === AST_NODE_TYPES.ClassExpression) &&
    node.superClass?.type === AST_NODE_TYPES.Identifier &&
    node.superClass.name === 'EventSourcedAggregate'
  );
}
