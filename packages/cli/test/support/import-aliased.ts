import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ALIASED = /(from |import )'@\/([^']+)'/g;

/**
 * Loads a generated TypeScript file and every file of the project it reaches through the default
 * alias (`@/contexts/...`), which nothing here resolves: each one that names the alias is loaded
 * through a copy whose imports name the copies, or the files, they reach. The packages are those
 * of the `node_modules` of the project.
 */
export async function importAliased(root: string, file: string): Promise<unknown> {
  const loaded: unknown = await import(pathToFileURL(resolvedPath(root, path.join(root, file), new Map())).href);

  return loaded;
}

/** The file itself when it names no alias, else its copy, written once however many files reach it. */
function resolvedPath(root: string, absolute: string, resolved: Map<string, string>): string {
  const known = resolved.get(absolute);

  if (known !== undefined) {
    return known;
  }

  const source = fs.readFileSync(absolute, 'utf8');

  if (!source.includes("'@/")) {
    resolved.set(absolute, absolute);

    return absolute;
  }

  const copy = absolute.replace(/\.ts$/, '.resolved.ts');

  resolved.set(absolute, copy);

  const rewritten = source.replaceAll(ALIASED, (_, keyword: string, imported: string) => {
    const target = resolvedPath(root, sourceOf(root, imported), resolved);

    return `${keyword}'${pathToFileURL(target).href}'`;
  });

  fs.writeFileSync(copy, rewritten);

  return copy;
}

/** The module an alias names: its file, or the index of its folder. */
function sourceOf(root: string, imported: string): string {
  const file = path.join(root, 'src', `${imported}.ts`);

  return fs.existsSync(file) ? file : path.join(root, 'src', imported, 'index.ts');
}
