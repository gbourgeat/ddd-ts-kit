/** A wiring template is a list of `@@<region>` sections, each holding what to add there. */
export function parseWiring(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | undefined;

  for (const line of text.split('\n')) {
    const header = /^@@([\w-]+)\s*$/.exec(line);

    if (header?.[1] !== undefined) {
      current = header[1];
      sections.set(current, '');
    } else if (current !== undefined) {
      sections.set(current, `${sections.get(current) ?? ''}${line}\n`);
    }
  }

  return sections;
}
