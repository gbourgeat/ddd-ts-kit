import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

/**
 * Loads a generated TypeScript file, to call what it exports. A file that imports another one
 * of the project through the default alias (`@/platform/...`), or one of the `packages` named,
 * which a project in a temporary directory has not installed, is loaded through a copy whose
 * imports name those files, since nothing here reads the `paths` of the project.
 */
export async function importGenerated(root: string, file: string, packages: readonly string[] = []): Promise<unknown> {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const copied = source.includes("from '@/") || packages.length > 0;
  const target = copied ? resolvedCopy(root, file, source, packages) : path.join(root, file);
  const loaded: unknown = await import(pathToFileURL(target).href);

  return loaded;
}

function resolvedCopy(root: string, file: string, source: string, packages: readonly string[]): string {
  const aliased = source.replaceAll(
    /from '@\/([^']+)'/g,
    (_, imported: string) => `from '${pathToFileURL(path.join(root, 'src', `${imported}.ts`)).href}'`,
  );

  const resolved = packages.reduce(
    (text, name) => text.replaceAll(`from '${name}'`, `from '${pathToFileURL(require.resolve(name)).href}'`),
    aliased,
  );

  const copy = path.join(root, file.replace(/\.ts$/, '.resolved.ts'));

  fs.writeFileSync(copy, resolved);

  return copy;
}
