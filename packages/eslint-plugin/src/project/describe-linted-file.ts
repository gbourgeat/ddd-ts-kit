import path from 'node:path';
import { isTestFile } from './is-test-file';
import { locate } from './locate';
import { toPosix } from './to-posix';
import { isRecord } from './is-record';
import { parseConfig } from './parse-config';
import type { Config } from './config';
import type { Project, LintedFile } from './linted-file';
import type { LintHost } from './lint-host';
import type { PluginSettings } from './plugin-settings';
import { findProject } from './find-project';

const SETTINGS_KEY = 'ddd-ts-kit';

const injectedConfigs = new WeakMap<object, Config>();

const DEFAULT_CONFIG = parseConfig({});

export function describeLintedFile(host: LintHost): LintedFile {
  const settings = readSettings(host.settings[SETTINGS_KEY]);
  const absolute = path.resolve(host.cwd, host.filename);

  const project = injectedProject(settings, host.cwd) ??
    findProject(path.dirname(absolute)) ?? { root: host.cwd, config: DEFAULT_CONFIG };

  const file = settings.filename ?? toPosix(path.relative(project.root, absolute));
  const location = locate(project.config, file);

  return { ...project, path: file, location, isTest: isTestFile(file, location) };
}

function readSettings(value: unknown): PluginSettings {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...(value['config'] === undefined ? {} : { config: value['config'] }),
    ...(typeof value['rootDir'] === 'string' ? { rootDir: value['rootDir'] } : {}),
    ...(typeof value['filename'] === 'string' ? { filename: value['filename'] } : {}),
  };
}

function injectedProject(settings: PluginSettings, cwd: string): Project | undefined {
  if (!isRecord(settings.config)) {
    return undefined;
  }

  const config = injectedConfigs.get(settings.config) ?? parseConfig(settings.config);

  injectedConfigs.set(settings.config, config);

  return { root: settings.rootDir ?? cwd, config };
}
