import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

/** The packages a generated file imports are resolved from the kit package that declares them. */
const KIT_PACKAGES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** A package a generated file imports, and the kit package (`auth`) whose devDependencies hold it. */
export interface GeneratedImport {
  readonly name: string;
  readonly from: string;
}

/**
 * Loads a generated TypeScript file, to call what it exports. A file that imports another one
 * of the project through the default alias (`@/platform/...`), or one of the `packages` named,
 * which a project in a temporary directory has not installed, is loaded through a copy whose
 * imports name those files, since nothing here reads the `paths` of the project. A package is
 * named with the kit package whose devDependencies hold it (`passport-jwt` from `auth`), and
 * resolved from there, so that a layout that does not hoist them (pnpm) finds it too.
 */
export async function importGenerated(
  root: string,
  file: string,
  packages: readonly GeneratedImport[] = [],
): Promise<unknown> {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const copied = source.includes("from '@/") || packages.length > 0;
  const target = copied ? resolvedCopy(root, file, source, packages) : path.join(root, file);
  const loaded: unknown = await import(pathToFileURL(target).href);

  return loaded;
}

function resolvedCopy(root: string, file: string, source: string, packages: readonly GeneratedImport[]): string {
  const aliased = source.replaceAll(
    /from '@\/([^']+)'/g,
    (_, imported: string) => `from '${pathToFileURL(path.join(root, 'src', `${imported}.ts`)).href}'`,
  );

  const resolved = packages.reduce((text, { name, from }) => {
    const resolvedName = require.resolve(name, { paths: [path.join(KIT_PACKAGES, from)] });

    return text.replaceAll(`from '${name}'`, `from '${pathToFileURL(resolvedName).href}'`);
  }, aliased);

  const copy = path.join(root, file.replace(/\.ts$/, '.resolved.ts'));

  fs.writeFileSync(copy, resolved);

  return copy;
}
