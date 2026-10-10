/** A path or a package name as a literal inside a regular expression. */
export function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
