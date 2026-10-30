import { BRACKET_DEPTH } from './bracket-depth';

/** The two branches of a choice outside any bracket, `a` and `b` of `test ? a : b`, or `undefined` when it is no choice. */
export function choiceBranches(bare: string): readonly [string, string] | undefined {
  const question = questionMark(bare);

  if (question === undefined) {
    return undefined;
  }

  const colon = matchingColon(bare, question);

  return [bare.slice(question + 1, colon), bare.slice(colon + 1)];
}

/** The first `?` outside any bracket that starts a choice: never `?.` or `??`. */
function questionMark(bare: string): number | undefined {
  let depth = 0;

  for (let index = 0; index < bare.length; index += 1) {
    depth += BRACKET_DEPTH[bare.charAt(index)] ?? 0;

    if (depth === 0 && bare.charAt(index) === '?') {
      if (bare.charAt(index + 1) !== '.' && bare.charAt(index + 1) !== '?') {
        return index;
      }

      index += 1;
    }
  }

  return undefined;
}

/** The `:` of the `?` at `question`, past the choices nested in its first branch. */
function matchingColon(bare: string, question: number): number {
  let depth = 0;
  let open = 1;

  for (let index = question + 1; index < bare.length; index += 1) {
    const char = bare.charAt(index);

    depth += BRACKET_DEPTH[char] ?? 0;
    open += depth === 0 ? ({ '?': 1, ':': -1 }[char] ?? 0) : 0;

    if (open === 0) {
      return index;
    }
  }

  return bare.length;
}
