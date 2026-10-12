import { builtinModules } from 'node:module';
import path from 'node:path';
import { aliasRoots } from '../../alias/index.js';
import type { Config } from '../../config/index.js';
import type { ImportTarget } from '../model/import-target.js';
import { locate } from './locate.js';

const SOURCE = /\.(?:ts|mts|cts)$/;
/** A file that is not a module of the project, named with its own extension. */
const ASSET = /\.(?:json|node|wasm|[jt]sx)$/;
const BUILTINS = new Set(builtinModules);

/** Classifies by path alone: the imported file does not have to exist for a rule to judge it. */
export function resolveImport(config: Config, fromFile: string, specifier: string): ImportTarget {
  if (specifier.startsWith('.')) {
    return asFile(config, path.posix.join(path.posix.dirname(fromFile), specifier));
  }

  const root = aliasRoots(config).find(({ prefix }) => prefix !== '' && specifier.startsWith(prefix));

  if (root !== undefined) {
    return asFile(config, path.posix.join(root.directory, specifier.slice(root.prefix.length)));
  }

  if (specifier.startsWith('node:')) {
    return { kind: 'builtin', name: specifier };
  }

  if (BUILTINS.has(packageName(specifier))) {
    return { kind: 'builtin', name: `node:${specifier}` };
  }

  return { kind: 'package', name: packageName(specifier) };
}

function asFile(config: Config, target: string): ImportTarget {
  const clean = path.posix.normalize(target).replace(/\.(?:js|mjs|cjs)$/, '.ts');
  // Written without its extension, a module is named by what remains, dots included: `invoice.aggregate` is `invoice.aggregate.ts`.
  const withExtension = SOURCE.test(clean) || ASSET.test(clean) ? clean : `${clean}.ts`;

  return { kind: 'file', path: withExtension, location: locate(config, withExtension) };
}

function packageName(specifier: string): string {
  const [first = '', second] = specifier.split('/');

  return first.startsWith('@') && second !== undefined ? `${first}/${second}` : first;
}
