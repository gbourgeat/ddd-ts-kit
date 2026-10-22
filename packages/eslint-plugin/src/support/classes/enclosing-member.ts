import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { ancestors } from '../ancestors';

export interface MemberSite {
  readonly member: TSESTree.ClassElement;
  readonly body: TSESTree.ClassBody;
}

/** The class member a node belongs to, for the innermost class around it. */
export function enclosingMember(node: TSESTree.Node): MemberSite | undefined {
  let child = node;

  for (const parent of ancestors(node)) {
    if (parent.type === AST_NODE_TYPES.ClassBody) {
      const member = parent.body.find((candidate) => candidate === child);

      return member === undefined ? undefined : { member, body: parent };
    }

    child = parent;
  }

  return undefined;
}
