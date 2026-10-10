import type { SpanNode } from '@ddd-ts-kit/tracing/testing';

/**
 * A trace as the business reads it: without the calls an adapter makes on itself (the `save` of
 * a repository calling its own `insert`), which say how the adapter is written, not what
 * happened. What is left is asserted with `expectSpanTree`.
 */
export function storyOf(trace: readonly SpanNode[]): SpanNode[] {
  return trace.map((span) => ({
    ...span,
    children: storyOf(span.children.filter((child) => !isOwnCall(span, child))),
  }));
}

function isOwnCall(caller: SpanNode, called: SpanNode): boolean {
  const adapter = /^(?:repository|gateway|external) [^.]+\./.exec(caller.name)?.[0];

  return adapter !== undefined && called.name.startsWith(adapter);
}
