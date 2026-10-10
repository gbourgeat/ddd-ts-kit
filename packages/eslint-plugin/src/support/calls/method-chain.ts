import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { propertyName } from '../globals/property-name.js';

export interface ChainLink {
  readonly name: string;
  readonly call: TSESTree.CallExpression;
}

/** `builder.command(X).requires(p).handledBy(H)` read from its last call: `command`, `requires`, `handledBy`. */
export function methodChain(last: TSESTree.CallExpression): ChainLink[] {
  const links: ChainLink[] = [];
  let current: TSESTree.Node = last;

  while (current.type === AST_NODE_TYPES.CallExpression && current.callee.type === AST_NODE_TYPES.MemberExpression) {
    links.unshift({ name: propertyName(current.callee) ?? '', call: current });
    current = current.callee.object;
  }

  return links;
}
