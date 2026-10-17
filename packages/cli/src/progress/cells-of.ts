/** The cells of a Markdown table row, trimmed; none for a line that is not a row. A `\|` inside a cell is a bar of its text. */
export function cellsOf(line: string): string[] {
  const row = line.trim();

  if (!row.startsWith('|') || !row.endsWith('|')) {
    return [];
  }

  return row
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'));
}
