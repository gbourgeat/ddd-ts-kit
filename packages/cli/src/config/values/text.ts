export function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
