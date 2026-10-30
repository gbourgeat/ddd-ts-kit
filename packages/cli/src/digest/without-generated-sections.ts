/** A line that opens a region the kit writes: `<!-- ddd-ts-kit:reference -->`, `// ddd-ts-kit:schemas`. */
const OPENING = /^\s*(?:\/\/|<!--)\s*ddd-ts-kit:([\w-]+)\s*(?:-->)?\s*$/;

/** The text with the lines of each region the kit writes left out, its markers kept: what a person wrote in it. */
export function withoutGeneratedSections(text: string): string {
  const kept: string[] = [];
  let open: string | undefined;

  for (const line of text.split('\n')) {
    if (open === undefined) {
      open = OPENING.exec(line)?.[1];
      kept.push(line);
    } else if (closes(line, open)) {
      open = undefined;
      kept.push(line);
    }
  }

  return kept.join('\n');
}

function closes(line: string, region: string): boolean {
  return new RegExp(`^\\s*(?://|<!--)\\s*/ddd-ts-kit:${region}\\s*(?:-->)?\\s*$`).test(line);
}
