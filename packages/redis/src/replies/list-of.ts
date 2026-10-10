/** A reply of the server read as a list: anything else, `null` included, is an empty one. */
export function listOf(reply: unknown): readonly unknown[] {
  return isList(reply) ? reply : [];
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
