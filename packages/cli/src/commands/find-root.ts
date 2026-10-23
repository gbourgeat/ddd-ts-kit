import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE } from '../config';

/** The closest directory, upward from `start`, holding the config file; `start` itself when none does. */
export function findRoot(start: string): string {
  let current = start;

  for (;;) {
    if (fs.existsSync(path.join(current, CONFIG_FILE))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return start;
    }

    current = parent;
  }
}
