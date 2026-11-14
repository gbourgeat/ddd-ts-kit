/** What a region of the index holds, between its markers. */
export function regionOf(index: string, region: string): string {
  return new RegExp(`// ddd-ts-kit:${region}\\n([\\s\\S]*?)// /ddd-ts-kit:${region}`).exec(index)?.[1] ?? '';
}
