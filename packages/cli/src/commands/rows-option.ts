/** `--rows 4.15,4.16`: the ids of the # column, as written, a `#` before one left out. */
export function rowsOption(rows: string | undefined): { rows?: string[] } {
  if (rows === undefined) {
    return {};
  }

  return {
    rows: rows
      .split(',')
      .map((id) => id.trim().replace(/^#/, ''))
      .filter((id) => id !== ''),
  };
}
