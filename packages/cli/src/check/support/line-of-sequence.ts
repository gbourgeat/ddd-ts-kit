/** 1-based line where the last of `needles` is found, each searched after the previous one; 1 when the first is absent. */
export function lineOfSequence(text: string, needles: readonly string[]): number {
  let at = 0;

  for (const needle of needles) {
    const found = text.indexOf(needle, at);

    if (found === -1) {
      break;
    }

    at = found;
  }

  return text.slice(0, at).split('\n').length;
}
