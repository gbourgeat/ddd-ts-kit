import { builtinModules } from 'node:module';
import path from 'node:path';
import type { Config } from './config.js';

export type Layer = 'domain' | 'application' | 'infrastructure' | 'presentation' | 'published-language' | 'test' | 'module' | 'root';

export interface ContextLocation {
  readonly area: 'context';
  readonly context: string;
  readonly layer: Layer;
  readonly inside: readonly string[];
}

export type Location = ContextLocation | { readonly area: 'shared-kernel' | 'platform' | 'main' | 'other' };

export type ImportTarget =
  | { readonly kind: 'file'; readonly path: string; readonly location: Location }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string };

const LAYERS: readonly Layer[] = ['domain', 'application', 'infrastructure', 'presentation', 'published-language', 'test'];
const SOURCE = /\.(?:ts|mts|cts)$/;
const BUILTINS = new Set(builtinModules);

/** Same decision table as `locate` of the CLI: a file is classified by its path alone. */
export function locate(config: Config, file: string): Location {
  if (isUnder(file, config.contextsDir)) return locateInContexts(config, file);
  if (isUnder(file, config.sharedKernelDir)) return { area: 'shared-kernel' };
  if (isUnder(file, config.platformDir)) return { area: 'platform' };
  if (file === `${config.sourceRoot}/main.ts`) return { area: 'main' };
  return { area: 'other' };
}

export function isTestFile(file: string, location: Location): boolean {
  return /\.(?:spec|test)\.ts$/.test(file) || (location.area === 'context' && location.layer === 'test');
}

export function resolveImport(config: Config, fromFile: string, specifier: string): ImportTarget {
  if (specifier.startsWith('.')) return fileTarget(config, path.posix.join(path.posix.dirname(fromFile), specifier));
  if (config.importAlias !== '' && specifier.startsWith(config.importAlias)) {
    return fileTarget(config, path.posix.join(config.sourceRoot, specifier.slice(config.importAlias.length)));
  }
  if (specifier.startsWith('node:')) return { kind: 'builtin', name: specifier };
  if (BUILTINS.has(packageName(specifier))) return { kind: 'builtin', name: `node:${specifier}` };
  return { kind: 'package', name: packageName(specifier) };
}

export function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

function locateInContexts(config: Config, file: string): Location {
  const [context, first, ...rest] = file.slice(config.contextsDir.length + 1).split('/');
  if (context === undefined || context === '' || first === undefined) return { area: 'other' };
  if (rest.length === 0) return locateAtContextRoot(context, first);
  const layer = LAYERS.find((candidate) => candidate === first) ?? 'root';
  return { area: 'context', context, layer, inside: layer === 'root' ? [first, ...rest] : rest };
}

/** A directory import (`../billing/published-language`) names the layer without a file. */
function locateAtContextRoot(context: string, entry: string): Location {
  if (entry === `${context}.module.ts`) return { area: 'context', context, layer: 'module', inside: [] };
  const named = LAYERS.find((candidate) => candidate === entry.replace(/\.ts$/, ''));
  return { area: 'context', context, layer: named ?? 'root', inside: [] };
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

function isUnder(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}/`);
}
