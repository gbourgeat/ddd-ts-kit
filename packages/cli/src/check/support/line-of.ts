/** 1-based line of the first occurrence of `needle` in `text`, or 1. */
export function lineOf(text: string, needle: string): number {
  const at = text.indexOf(needle);

  return at === -1 ? 1 : text.slice(0, at).split('\n').length;
}
