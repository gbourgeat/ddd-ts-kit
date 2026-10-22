import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import type { Config } from './config';
import { CONFIG_FILE } from './config-file';
import { parseConfig } from './parse-config';

export interface LoadedConfig {
  readonly config: Config;
  /** Kept to report `config/valid` violations with a line number. */
  readonly text: string;
}

export function readConfig(root: string): LoadedConfig {
  const content = contentOf(root);

  return { config: parseConfig(jsonOf(content)), text: content };
}

function contentOf(root: string): string {
  try {
    return fs.readFileSync(path.join(root, CONFIG_FILE), 'utf8');
  } catch {
    throw new CliError(
      `No ${CONFIG_FILE} in ${root}.`,
      'Run `ddd-ts-kit init` at the project root, or pass --cwd <project root>.',
    );
  }
}

function jsonOf(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new CliError(`${CONFIG_FILE} is not valid JSON.`, 'Fix the syntax; the file must be plain JSON.');
  }
}
