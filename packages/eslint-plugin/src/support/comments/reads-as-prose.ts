/** A sentence is mostly plain words; a statement is mostly identifiers glued to punctuation. */
export function readsAsProse(text: string): boolean {
  const tokens = text.split(/\s+/);
  const words = tokens.filter((token) => /^[A-Za-z'`-]+[,.:;!?]?$/.test(token));

  return tokens.length >= 5 && words.length / tokens.length >= 0.8;
}
