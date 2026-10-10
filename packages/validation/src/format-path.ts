/** Joins path segments the way every adapter reports them. */
export function formatPath(segments: readonly PropertyKey[]): string {
  return segments.map((segment) => String(segment)).join('.');
}
