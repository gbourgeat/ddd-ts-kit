import type { TSESTree } from '@typescript-eslint/utils';
import { isRecord } from '../project/is-record.js';

/** `node` and every node below it, in source order, without a visitor: for a tree read once. */
export function* descendants(node: TSESTree.Node): Generator<TSESTree.Node> {
  yield node;

  const entries: [string, unknown][] = Object.entries(node);

  for (const [key, value] of entries) {
    if (key === 'parent') continue;

    const children: readonly unknown[] = Array.isArray(value) ? value : [value];

    for (const child of children) {
      if (isNode(child)) yield* descendants(child);
    }
  }
}

function isNode(value: unknown): value is TSESTree.Node {
  return isRecord(value) && typeof value['type'] === 'string' && Array.isArray(value['range']);
}
