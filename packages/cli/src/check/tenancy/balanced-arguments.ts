const DEPTH: Readonly<Record<string, number>> = { '(': 1, ')': -1 };

/** The text between the parenthesis at `open` and the one that closes it, or the rest of the code when none does. */
export function balancedArguments(code: string, open: number): string {
  let depth = 0;

  for (let index = open; index < code.length; index += 1) {
    depth += DEPTH[code.charAt(index)] ?? 0;

    if (depth === 0) {
      return code.slice(open + 1, index);
    }
  }

  return code.slice(open + 1);
}
