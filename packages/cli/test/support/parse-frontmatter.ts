/** A minimal reading of YAML frontmatter: top-level keys, each holding a list of quoted strings or one quoted string. */
export function parseFrontmatter(text: string): Record<string, string[]> {
  const [, block] = /^---\n([\s\S]*?)\n---\n/.exec(text) ?? [];

  if (block === undefined) {
    throw new Error('The file does not start with a frontmatter block.');
  }

  const keys: Record<string, string[]> = {};
  let current: string[] | undefined;

  for (const line of block.split('\n')) {
    const key = /^([A-Za-z][\w-]*):\s*$/.exec(line)?.[1];
    const item = /^ {2}- "((?:[^"\\]|\\.)*)"$/.exec(line)?.[1];
    const scalar = /^([A-Za-z][\w-]*):\s*"((?:[^"\\]|\\.)*)"$/.exec(line);

    if (scalar?.[1] !== undefined && scalar[2] !== undefined) {
      keys[scalar[1]] = [scalar[2]];
      current = undefined;
    } else if (key !== undefined) {
      current = [];
      keys[key] = current;
    } else if (item !== undefined && current !== undefined) {
      current.push(item);
    } else {
      throw new Error(`Unreadable frontmatter line: ${line}`);
    }
  }

  return keys;
}
