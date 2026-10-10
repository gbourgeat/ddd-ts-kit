import type { ExpectedSpan } from './expected-span.js';
import { renderSpanTree } from './render-span-tree.js';
import { spanMismatches } from './span-mismatches.js';
import type { SpanNode } from './span-node.js';

/**
 * Asserts that a trace is exactly the tree described: the same spans, under the same parents,
 * in the order they started, with the kinds, statuses and attributes named. On a mismatch it
 * throws an error that lists what differs, then shows both trees with the attributes the
 * expectation names. It depends on no test framework.
 */
export function expectSpanTree(actual: readonly SpanNode[], expected: readonly ExpectedSpan[]): void {
  const mismatches = spanMismatches(actual, expected);

  if (mismatches.length === 0) {
    return;
  }

  const keys = [...new Set(attributeKeys(expected))];

  throw new Error(
    [
      'The trace is not the one expected.',
      ...mismatches.map((mismatch) => `  - ${mismatch}`),
      '',
      'Expected:',
      renderSpanTree(expected, keys),
      '',
      'Found:',
      renderSpanTree(actual, keys),
    ].join('\n'),
  );
}

function attributeKeys(spans: readonly ExpectedSpan[]): string[] {
  return spans.flatMap((span) => [...Object.keys(span.attributes ?? {}), ...attributeKeys(span.children ?? [])]);
}
