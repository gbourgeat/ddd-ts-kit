import fs from 'node:fs';
import { TEMPLATES_ROOT } from './templates-root.js';

/** Every template of the package, relative to its templates directory. */
export function listTemplates(directory = ''): string[] {
  const found: string[] = [];

  for (const entry of fs.readdirSync(`${TEMPLATES_ROOT}${directory}`, { withFileTypes: true })) {
    const relative = directory === '' ? entry.name : `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      found.push(...listTemplates(relative));
    } else {
      found.push(relative);
    }
  }

  return found.sort();
}
