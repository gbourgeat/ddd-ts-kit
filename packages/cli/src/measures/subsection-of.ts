/** The lines under a `### <title>` heading of a text, up to the next heading of any level; undefined without it. */
export function subsectionOf(text: string, title: string): string | undefined {
  const lines = text.split('\n');
  const heading = lines.findIndex((line) => line.trim().toLowerCase() === `### ${title.toLowerCase()}`);

  if (heading === -1) {
    return undefined;
  }

  const end = lines.findIndex((line, at) => at > heading && /^#{1,3}\s/.test(line));

  return lines.slice(heading + 1, end === -1 ? undefined : end).join('\n');
}
