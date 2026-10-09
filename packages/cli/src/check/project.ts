import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { isOneOf, parseConfig, readConfig, SEVERITIES, type Config, type Severity } from '../config.js';
import { scan } from './scanner.js';
import { DEFAULT_SEVERITIES } from './severity.js';
import { readStructure, type Structure } from './structure.js';
import type { ImportTarget, Layer, Location, Project, SourceFile } from './types.js';

const LAYERS: readonly Layer[] = ['domain', 'application', 'infrastructure', 'presentation', 'published-language', 'test'];
const SOURCE = /\.(?:ts|mts|cts)$/;
const DECLARATION = /\.d\.(?:ts|mts|cts)$/;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git']);
const BUILTINS = new Set(builtinModules);

export const toPosix = (file: string): string => file.split(path.sep).join('/');

export function locate(config: Config, file: string): Location {
  if (isUnder(file, config.contextsDir)) return locateInContexts(file.slice(config.contextsDir.length + 1));
  if (isUnder(file, config.sharedKernelDir)) return { area: 'shared-kernel' };
  if (isUnder(file, config.platformDir)) return { area: 'platform' };
  if (file === `${config.sourceRoot}/main.ts`) return { area: 'main' };
  return { area: 'other' };
}

function isUnder(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}/`);
}

function locateInContexts(relative: string): Location {
  const [context, first, ...rest] = relative.split('/');
  if (context === undefined || context === '' || first === undefined) return { area: 'other' };
  if (rest.length === 0) return locateAtContextRoot(context, first);
  const layer = LAYERS.find((candidate) => candidate === first) ?? 'root';
  return { area: 'context', context, layer, inside: layer === 'root' ? [first, ...rest] : rest };
}

function locateAtContextRoot(context: string, entry: string): Location {
  if (entry === `${context}.module.ts`) return { area: 'context', context, layer: 'module', inside: [] };
  // A directory import (`../billing/published-language`) names the layer without a file.
  const named = LAYERS.find((candidate) => candidate === entry.replace(/\.ts$/, ''));
  return { area: 'context', context, layer: named ?? 'root', inside: [] };
}

export function isTestFile(file: string, location: Location): boolean {
  return /\.(?:spec|test)\.ts$/.test(file) || (location.area === 'context' && location.layer === 'test');
}

/** Classifies by path alone: the imported file does not have to exist for a rule to judge it. */
export function resolveImport(config: Config, fromFile: string, specifier: string): ImportTarget {
  const asFile = (target: string): ImportTarget => {
    const clean = path.posix.normalize(target).replace(/\.(?:js|mjs|cjs)$/, '.ts');
    const withExtension = SOURCE.test(clean) || path.posix.extname(clean) !== '' ? clean : `${clean}.ts`;
    return { kind: 'file', path: withExtension, location: locate(config, withExtension) };
  };
  if (specifier.startsWith('.')) return asFile(path.posix.join(path.posix.dirname(fromFile), specifier));
  if (config.importAlias !== '' && specifier.startsWith(config.importAlias)) {
    return asFile(path.posix.join(config.sourceRoot, specifier.slice(config.importAlias.length)));
  }
  if (specifier.startsWith('node:')) return { kind: 'builtin', name: specifier };
  if (BUILTINS.has(packageName(specifier))) return { kind: 'builtin', name: `node:${specifier}` };
  return { kind: 'package', name: packageName(specifier) };
}

export interface ProjectOptions {
  /** Load only this source instead of walking the tree (editor hook path). */
  readonly onlyFile?: string;
}

/** Sources of arbitrary directories, without a project around them: for the rules that judge a file alone. */
export function loadLooseProject(root: string, directories: readonly string[]): Project {
  const config = parseConfig({});
  const files: SourceFile[] = [];
  for (const directory of directories) {
    walk(root, directory, (file, isDirectory) => {
      if (isDirectory || !SOURCE.test(file) || DECLARATION.test(file)) return;
      files.push(loadSourceFile(config, file, fs.readFileSync(path.join(root, file), 'utf8')));
    });
  }
  return assemble({ root, config, configText: '', files, contextEntries: [], contextsOnDisk: [] });
}

export function loadProject(root: string, options: ProjectOptions = {}): Project {
  const { config, text: configText } = readConfig(root);
  const files: SourceFile[] = [];
  const contextEntries: string[] = [];
  const contextsOnDisk: string[] = [];

  if (options.onlyFile !== undefined) {
    const content = fs.readFileSync(path.join(root, options.onlyFile), 'utf8');
    files.push(loadSourceFile(config, options.onlyFile, content));
  } else {
    walk(root, config.sourceRoot, (file, isDirectory) => {
      if (isUnder(file, config.contextsDir)) {
        contextEntries.push(isDirectory ? `${file}/` : file);
        if (isDirectory && path.posix.dirname(file) === config.contextsDir) contextsOnDisk.push(path.posix.basename(file));
      }
      if (!isDirectory && SOURCE.test(file) && !DECLARATION.test(file)) {
        files.push(loadSourceFile(config, file, fs.readFileSync(path.join(root, file), 'utf8')));
      }
    });
  }

  return assemble({ root, config, configText, files, contextEntries, contextsOnDisk });
}

function assemble(loaded: Omit<Project, 'severity' | 'locate'>): Project {
  const { config } = loaded;
  return {
    ...loaded,
    severity: (ruleId: string): Severity => {
      const configured = config.rules[ruleId];
      return isOneOf(SEVERITIES, configured) ? configured : (DEFAULT_SEVERITIES[ruleId] ?? 'error');
    },
    locate: (file: string) => locate(config, file),
  };
}

function packageName(specifier: string): string {
  const [first = '', second] = specifier.split('/');
  return first.startsWith('@') && second !== undefined ? `${first}/${second}` : first;
}

function walk(root: string, directory: string, visit: (file: string, isDirectory: boolean) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, directory), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      visit(relative, true);
      walk(root, relative, visit);
    } else {
      visit(relative, false);
    }
  }
}

function loadSourceFile(config: Config, file: string, text: string): SourceFile {
  const location = locate(config, file);
  const scanned = scan(text);
  let structure: Structure | undefined;
  return {
    get structure(): Structure {
      structure ??= readStructure(scanned);
      return structure;
    },
    path: file,
    location,
    isTest: isTestFile(file, location),
    text,
    scan: scanned,
    imports: scanned.imports.map((record) => ({
      specifier: record.specifier,
      line: record.line,
      names: record.names,
      target: resolveImport(config, file, record.specifier),
    })),
  };
}
