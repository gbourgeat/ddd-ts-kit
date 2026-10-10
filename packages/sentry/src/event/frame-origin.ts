const AT = 'at ';
const ASYNC = 'async ';
const NOT_IN_A_FILE_NAME = '/\\:()';
const LINE_BREAK = /[\r\u2028\u2029]/;

/**
 * The function and the file of a stack frame, `at <function> (<directory>/<file>:<line>:<column>)`
 * where the function and the directory are optional; undefined for any other line. Read by hand:
 * a stack is as long as the code that raised wants it.
 */
export function frameOrigin(line: string): string | undefined {
  const text = line.trimStart();
  const frame = text.startsWith(AT) ? withoutPosition(text.slice(AT.length)) : undefined;

  if (frame === undefined) {
    return undefined;
  }

  const readings = frame.startsWith(ASYNC) ? [frame.slice(ASYNC.length), frame] : [frame];

  for (const reading of readings) {
    const origin = originOf(reading);

    if (origin !== undefined) {
      return origin;
    }
  }

  return undefined;
}

/** The frame without `:<line>:<column>` and the parenthesis that may close it. */
function withoutPosition(frame: string): string | undefined {
  const column = numberStart(frame, frame.endsWith(')') ? frame.length - 1 : frame.length);
  const line = column === undefined ? undefined : numberStart(frame, column - 1);

  return line === undefined ? undefined : frame.slice(0, line - 1);
}

/** Where the digits that end at `end` start, when a colon precedes them. */
function numberStart(text: string, end: number): number | undefined {
  let start = end;

  while (start > 0 && text.charAt(start - 1) >= '0' && text.charAt(start - 1) <= '9') {
    start -= 1;
  }

  return start < end && text.charAt(start - 1) === ':' ? start : undefined;
}

function originOf(located: string): string | undefined {
  let start = located.length;

  while (start > 0 && !NOT_IN_A_FILE_NAME.includes(located.charAt(start - 1))) {
    start -= 1;
  }

  const named = start === located.length ? undefined : functionOf(located.slice(0, start));

  return named === undefined ? undefined : [...named, located.slice(start)].join(' ');
}

/** The function named before the file: none, one, or undefined when the text is not the start of a frame. */
function functionOf(head: string): string[] | undefined {
  if (head === '') {
    return [];
  }

  if (LINE_BREAK.test(head)) {
    return undefined;
  }

  if (head.endsWith('/') || head.endsWith('\\')) {
    const open = head.indexOf(' (', 1);

    return open === -1 ? [] : [head.slice(0, open)];
  }

  return head.endsWith(' (') && head.length > 2 ? [head.slice(0, -2)] : undefined;
}
