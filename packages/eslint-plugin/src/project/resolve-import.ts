import { builtinModules } from 'node:module';
import path from 'node:path';
import type { Config } from './config.js';
import type { Location } from './location.js';
import { locate } from './locate.js';

export type ImportTarget =
  | { readonly kind: 'file'; readonly path: string; readonly location: Location }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string };

const SOURCE = /\.(?:ts|mts|cts)$/;

const BUILTINS = new Set(builtinModules);

export function resolveImport(config: Config, fromFile: string, specifier: string): ImportTarget {
  if (specifier.startsWith('.')) {
    return fileTarget(config, path.posix.join(path.posix.dirname(fromFile), specifier));
  }

  if (config.importAlias !== '' && specifier.startsWith(config.importAlias)) {
    return fileTarget(config, path.posix.join(config.sourceRoot, specifier.slice(config.importAlias.length)));
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
  const withExtension = SOURCE.test(clean) || path.posix.extname(clean) !== '' ? clean : `${clean}.ts`;

  return { kind: 'file', path: withExtension, location: locate(config, withExtension) };
}

function packageName(specifier: string): string {
  const [first = '', second] = specifier.split('/');

  return first.startsWith('@') && second !== undefined ? `${first}/${second}` : first;
}
