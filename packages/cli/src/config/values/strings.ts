export function strings(value: unknown, fallback: readonly string[]): readonly string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : fallback;
}
