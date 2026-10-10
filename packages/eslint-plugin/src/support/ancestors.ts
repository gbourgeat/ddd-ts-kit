import type { TSESTree } from '@typescript-eslint/utils';

/** From the parent of `node` up to the program, whose own parent is absent. */
export function* ancestors(node: TSESTree.Node): Generator<TSESTree.Node> {
  for (let current = node.parent; current; current = current.parent) {
    yield current;
  }
}
