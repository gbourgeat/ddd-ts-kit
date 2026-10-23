import { builtinModules } from 'node:module';
import path from 'node:path';
import { aliasRoots } from './alias-roots';
import type { Config } from './config';
import type { Location } from './location';
import { locate } from './locate';

export type ImportTarget =
  | { readonly kind: 'file'; readonly path: string; readonly location: Location }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string };

const SOURCE = /\.(?:ts|mts|cts)$/;

/** A file that is not a module of the project, named with its own extension. */
const ASSET = /\.(?:json|node|wasm|[jt]sx)$/;

const BUILTINS = new Set(builtinModules);

export function resolveImport(config: Config, fromFile: string, specifier: string): ImportTarget {
  if (specifier.startsWith('.')) {
    return fileTarget(config, path.posix.join(path.posix.dirname(fromFile), specifier));
  }

  const root = aliasRoots(config).find(({ prefix }) => prefix !== '' && specifier.startsWith(prefix));

  if (root !== undefined) {
    return fileTarget(config, path.posix.join(root.directory, specifier.slice(root.prefix.length)));
  }

  if (specifier.startsWith('node:')) {
    return { kind: 'builtin', name: specifier };
  }

  if (BUILTINS.has(packageName(specifier))) {
    return { kind: 'builtin', name: `node:${specifier}` };
  }

  return { kind: 'package', name: packageName(specifier) };
}

function fileTarget(config: Config, target: string): ImportTarget {
  const clean = path.posix.normalize(target).replace(/\.(?:js|mjs|cjs)$/, '.ts');
  // Written without its extension, a module is named by what remains, dots included: `invoice.aggregate` is `invoice.aggregate.ts`.
  const withExtension = SOURCE.test(clean) || ASSET.test(clean) ? clean : `${clean}.ts`;

  return { kind: 'file', path: withExtension, location: locate(config, withExtension) };
}

function packageName(specifier: string): string {
  const [first = '', second] = specifier.split('/');

  return first.startsWith('@') && second !== undefined ? `${first}/${second}` : first;
}
