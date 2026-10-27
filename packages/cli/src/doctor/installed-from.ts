import fs from 'node:fs';
import path from 'node:path';

/** The real directory of a package as Node resolves it from `start`, nearest node_modules first; undefined when none holds it. */
export function installedFrom(start: string, name: string): string | undefined {
  for (let directory = path.resolve(start); ; directory = path.dirname(directory)) {
    const candidate = path.join(directory, 'node_modules', name);

    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return fs.realpathSync(candidate);
    }

    if (path.dirname(directory) === directory) {
      return undefined;
    }
  }
}
