/** What makes a statement, or the block it sits in, run in some cases only. */
const CONDITION = /(?<![\w$.])(?:if|else|switch|case|for|while|do|try|catch|finally|when)(?![\w$])/;
const RECEIVER = /^[\s\w$.]*$/;

/**
 * Whether the call whose name ends at `at` runs in some cases only: its statement starts with
 * anything but a receiver (a ternary, `&&`, an assignment), or a block around it is opened by a
 * condition, a loop or `when(...)`. Read on blanked code.
 */
export function isUnderCondition(code: string, at: number): boolean {
  const statement = code.slice(headStart(code, at), at);

  return (
    !RECEIVER.test(statement) ||
    CONDITION.test(statement) ||
    enclosingHeads(code, at).some((head) => CONDITION.test(head))
  );
}

/** The text that opens each block around `at`, the innermost first. */
function enclosingHeads(code: string, at: number): string[] {
  const heads: string[] = [];
  let closed = 0;

  for (let index = at - 1; index >= 0; index -= 1) {
    const char = code.charAt(index);

    if (char === '}') {
      closed += 1;
    } else if (char === '{' && closed > 0) {
      closed -= 1;
    } else if (char === '{') {
      heads.push(code.slice(headStart(code, index), index));
    }
  }

  return heads;
}

/** Offset after the `;`, `{` or `}` that ends what comes before the statement or the block head ending at `end`, parentheses skipped. */
function headStart(code: string, end: number): number {
  let nested = 0;

  for (let index = end - 1; index >= 0; index -= 1) {
    const char = code.charAt(index);

    if (char === ')') {
      nested += 1;
    } else if (char === '(') {
      nested -= 1;
    } else if (nested <= 0 && ';{}'.includes(char)) {
      return index + 1;
    }
  }

  return 0;
}
