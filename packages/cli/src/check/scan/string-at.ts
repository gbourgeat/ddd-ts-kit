/** The content of the string literal that starts at this offset of a source. */
export function stringAt(source: string, offset: number): string | undefined {
  return /^(['"`])([^'"`]*)\1/.exec(source.slice(offset))?.[2];
}
