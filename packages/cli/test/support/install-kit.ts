import fs from 'node:fs';
import path from 'node:path';
import { VERSION } from '../../src/version.js';

/**
 * node_modules as an install leaves it, without running one: each package of the kit
 * package.json declares at `version`, then the copy of the lockfile npm writes last.
 */
export function installKit(root: string, version = VERSION): void {
  const manifest: Record<string, Record<string, string> | undefined> = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );

  const declared = Object.keys({ ...manifest['dependencies'], ...manifest['devDependencies'] }).filter(
    (name) => name === 'ddd-ts-kit' || name.startsWith('@ddd-ts-kit/'),
  );

  for (const name of declared) {
    fs.mkdirSync(path.join(root, 'node_modules', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  }

  fs.writeFileSync(path.join(root, 'node_modules', '.package-lock.json'), '{}');
}
