import fs from 'node:fs';
import path from 'node:path';

const CONFIG_FILES = ['drizzle.config.ts', 'drizzle.config.js', 'drizzle.config.mjs'];

/** The `out` folder a drizzle config writes, when it is a string literal; `migrations`, the one `init` writes, otherwise. */
export function drizzleOutFolder(root: string): string {
  const text = CONFIG_FILES.map((file) => readIfPresent(path.join(root, file))).find((read) => read !== undefined);
  const written = text === undefined ? undefined : /\bout\s*:\s*['"`]([^'"`]+)['"`]/.exec(text)?.[1];

  return path.posix.normalize(written ?? 'migrations').replace(/\/$/, '');
}

function readIfPresent(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}
