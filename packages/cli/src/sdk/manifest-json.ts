/** A package.json as npm writes it and Biome keeps it: every object and every list expanded, one entry per line. */
export function manifestJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
