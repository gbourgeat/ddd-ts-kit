import fs from 'node:fs';
import { TEMPLATES_ROOT } from './templates-root.js';

const known = new Map<string, boolean>();

export function templateExists(name: string): boolean {
  const cached = known.get(name);

  if (cached !== undefined) {
    return cached;
  }

  const exists = fs.existsSync(`${TEMPLATES_ROOT}${name}`);

  known.set(name, exists);

  return exists;
}
