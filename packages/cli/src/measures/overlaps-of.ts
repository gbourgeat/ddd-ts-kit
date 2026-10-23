import type { Span } from './span.js';

/** For each story, the other ones whose span overlaps its own: built at the same time. */
export function overlapsOf(spans: readonly Span[]): Map<string, string[]> {
  return new Map(
    spans.map((span) => [
      span.story,
      spans
        .filter((other) => other.story !== span.story && other.from <= span.to && span.from <= other.to)
        .map((other) => other.story),
    ]),
  );
}
