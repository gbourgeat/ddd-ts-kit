import path from 'node:path';
import { isTestFile } from './is-test-file.js';
import { locate } from './locate.js';
import { toPosix } from './to-posix.js';
import { isRecord } from './is-record.js';
import { parseConfig } from './parse-config.js';
import type { Config } from './config.js';
import type { Project, LintedFile } from './linted-file.js';
import type { LintHost } from './lint-host.js';
import type { PluginSettings } from './plugin-settings.js';
import { findProject } from './find-project.js';

const SETTINGS_KEY = 'ddd-ts-kit';

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
