import fs from 'node:fs';
import path from 'node:path';

/** The Markdown files under a directory of the project, at any depth, relative to the root and sorted; none when it is missing. */
export function markdownUnder(root: string, directory: string): string[] {
  const absolute = path.join(root, directory);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = `${directory}/${entry.name}`;

      if (entry.isDirectory()) {
        return markdownUnder(root, relative);
      }

      return entry.isFile() && entry.name.endsWith('.md') ? [relative] : [];
    })
    .sort();
}
