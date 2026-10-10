/** The same text with everything but its line breaks turned into spaces: offsets and lines are preserved. */
export function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}
