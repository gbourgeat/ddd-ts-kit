import type { TSESTree } from '@typescript-eslint/utils';
import { isRecord } from '../project/is-record';

/**
 * `node` and every node below it, in source order, without a visitor: for a tree read once. Nothing
 * for what is not a node: a body a parser leaves null, as the JS plugin API of Oxlint does.
 */
export function* descendants(node: TSESTree.Node | null | undefined): Generator<TSESTree.Node> {
  if (node === null || node === undefined) {
    return;
  }

  yield node;

  const entries: [string, unknown][] = Object.entries(node);

  for (const [key, value] of entries) {
    if (key === 'parent') {
      continue;
    }

    const children: readonly unknown[] = Array.isArray(value) ? value : [value];

    for (const child of children) {
      if (isNode(child)) {
        yield* descendants(child);
      }
    }
  }
}

function isNode(value: unknown): value is TSESTree.Node {
  return isRecord(value) && typeof value['type'] === 'string' && Array.isArray(value['range']);
}
