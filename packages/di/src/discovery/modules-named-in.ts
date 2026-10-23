import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// `export const modules = ['a', 'b'];` as `ddd-ts-kit docs` writes it, or as a bundler rewrites it: other quotes, no spaces.
const NAMED = /\bmodules\s*=\s*\[([^\]]*)\]/;
const QUOTED = /["']([^"']+)["']/g;

/**
 * The modules of the model the generated `<context>.dependencies` file names (`ddd-ts-kit docs`
 * writes `export const modules = [...]` from the config), read from its text so that no file of
 * the context is loaded before its folder is checked. The text is read as esbuild, swc or Bun may
 * have rewritten it, with either quotes and any spacing. None without the file, or without the line.
 */
export async function modulesNamedIn(root: string, context: string, extensions: readonly string[]): Promise<string[]> {
  const present = new Set(await readdir(root));

  const file = extensions
    .map((extension) => `${context}.dependencies${extension}`)
    .find((candidate) => present.has(candidate));

  if (file === undefined) {
    return [];
  }

  const named = NAMED.exec(await readFile(path.join(root, file), 'utf8'))?.[1] ?? '';

  return [...named.matchAll(QUOTED)].map(([, module = '']) => module);
}
