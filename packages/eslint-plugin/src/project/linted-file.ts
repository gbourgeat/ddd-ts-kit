import fs from 'node:fs';
import path from 'node:path';
import { isTestFile, locate, toPosix, type Location } from './classify.js';
import { CONFIG_FILE, isRecord, parseConfig, type Config } from './config.js';

const SETTINGS_KEY = 'ddd-ts-kit';

export interface Project {
  readonly root: string;
  readonly config: Config;
}

export interface LintedFile extends Project {
  /** Posix path relative to the project root. */
  readonly path: string;
  readonly location: Location;
  readonly isTest: boolean;
}

export interface LintHost {
  readonly filename: string;
  readonly cwd: string;
  readonly settings: Readonly<Record<string, unknown>>;
}

/** `settings['ddd-ts-kit']`: lets a test or an editor inject what is otherwise read from disk. */
export interface PluginSettings {
  readonly config?: unknown;
  readonly rootDir?: string;
  /** Posix path relative to the project root, used instead of the real file name. */
  readonly filename?: string;
}

const projectsByDirectory = new Map<string, Project | undefined>();
const injectedConfigs = new WeakMap<object, Config>();
const DEFAULT_CONFIG = parseConfig({});

export function describeLintedFile(host: LintHost): LintedFile {
  const settings = readSettings(host.settings[SETTINGS_KEY]);
  const absolute = path.resolve(host.cwd, host.filename);
  const project = injectedProject(settings, host.cwd) ?? findProject(path.dirname(absolute)) ?? { root: host.cwd, config: DEFAULT_CONFIG };
  const file = settings.filename ?? toPosix(path.relative(project.root, absolute));
  const location = locate(project.config, file);
  return { ...project, path: file, location, isTest: isTestFile(file, location) };
}

/** Walks up from `directory` to the nearest `ddd-ts-kit.config.json`; every directory visited is remembered. */
export function findProject(directory: string): Project | undefined {
  if (projectsByDirectory.has(directory)) return projectsByDirectory.get(directory);
  const found = readProject(directory) ?? findInParent(directory);
  projectsByDirectory.set(directory, found);
  return found;
}

function readSettings(value: unknown): PluginSettings {
  if (!isRecord(value)) return {};
  return {
    ...(value['config'] === undefined ? {} : { config: value['config'] }),
    ...(typeof value['rootDir'] === 'string' ? { rootDir: value['rootDir'] } : {}),
    ...(typeof value['filename'] === 'string' ? { filename: value['filename'] } : {}),
  };
}

function injectedProject(settings: PluginSettings, cwd: string): Project | undefined {
  if (!isRecord(settings.config)) return undefined;
  const config = injectedConfigs.get(settings.config) ?? parseConfig(settings.config);
  injectedConfigs.set(settings.config, config);
  return { root: settings.rootDir ?? cwd, config };
}

function findInParent(directory: string): Project | undefined {
  const parent = path.dirname(directory);
  return parent === directory ? undefined : findProject(parent);
}

function readProject(directory: string): Project | undefined {
  let content: string;
  try {
    content = fs.readFileSync(path.join(directory, CONFIG_FILE), 'utf8');
  } catch {
    return undefined;
  }
  return { root: directory, config: parseConfig(parseJson(content)) };
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}
