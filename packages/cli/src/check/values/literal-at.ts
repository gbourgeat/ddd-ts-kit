/** The offset of the `{` of an object literal the expression starting at `from` is, through its parentheses; undefined for anything else. */
export function literalAt(code: string, from: number): number | undefined {
  const opening = /^[\s(]*/.exec(code.slice(from))?.[0].length ?? 0;
  const at = from + opening;

  return code.charAt(at) === '{' ? at : undefined;
}
