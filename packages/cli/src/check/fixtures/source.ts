/** A source written line by line, ending with a newline. */
export function source(...lines: string[]): string {
  return `${lines.join('\n')}\n`;
}
