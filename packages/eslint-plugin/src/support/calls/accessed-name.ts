import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { keyName } from '../classes/key-name';
import { propertyName } from '../globals/property-name';

/** The last name of an access: `access` for `access`, `this.access` and `this.#access` (with its hash). */
export function accessedName(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }

  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return undefined;
  }

  return node.computed ? propertyName(node) : keyName(node.property);
}
