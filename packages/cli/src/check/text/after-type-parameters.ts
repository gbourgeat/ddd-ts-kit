/** Offset just after the type parameter list met at `from`, white space aside, or `from` when there is none. */
export function afterTypeParameters(code: string, from: number): number {
  const open = from + (/^\s*/.exec(code.slice(from, from + 200))?.[0].length ?? 0);

  if (code.charAt(open) !== '<') return from;

  let depth = 0;

  for (let i = open; i < code.length; i += 1) {
    const char = code.charAt(i);

    if (char === '<') depth += 1;
    else if (char === '>' && code.charAt(i - 1) !== '=' && (depth -= 1) === 0) return i + 1;
  }

  return from;
}
