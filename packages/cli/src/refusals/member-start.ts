const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

/** Where a member written at `at` starts: the beginning of its line, or of the comment lines right above it. */
export function memberStart(source: string, at: number): number {
  let start = source.lastIndexOf('\n', at - 1) + 1;

  while (start > 0) {
    const above = source.lastIndexOf('\n', start - 2) + 1;

    if (!COMMENT_LINE.test(source.slice(above, start - 1))) {
      break;
    }

    start = above;
  }

  return start;
}
