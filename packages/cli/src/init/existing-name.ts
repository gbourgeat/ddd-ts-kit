import fs from 'node:fs';
import path from 'node:path';

/** The name of the package the project already is, when `init` runs in an existing one. */
export function existingName(root: string): string | undefined {
  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const name: unknown = typeof manifest === 'object' && manifest !== null ? Reflect.get(manifest, 'name') : undefined;

    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}
