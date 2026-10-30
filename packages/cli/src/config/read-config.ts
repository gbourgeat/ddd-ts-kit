import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import type { Config } from './config';
import { CONFIG_FILE } from './config-file';
import { parseConfig, type ParseOptions } from './parse-config';

/** Far past what the keys of a config nest: what lies deeper is no config, and printing it would overflow the stack. */
const MAX_DEPTH = 32;

export interface LoadedConfig {
  readonly config: Config;
  /** Kept to report `config/valid` violations with a line number. */
  readonly text: string;
}

export function readConfig(root: string, options?: ParseOptions): LoadedConfig {
  const content = contentOf(root);

  return { config: parseConfig(jsonOf(content), options), text: content };
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
  const json = parsed(content);

  if (nestedBeyond(json, MAX_DEPTH)) {
    throw new CliError(
      `${CONFIG_FILE} is nested more than ${MAX_DEPTH} levels deep.`,
      'Fix the file: no key of the config nests that far.',
    );
  }

  return json;
}

function parsed(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new CliError(`${CONFIG_FILE} is not valid JSON.`, 'Fix the syntax; the file must be plain JSON.');
  }
}

/** Whether `value` holds more levels than `limit`, read a level at a time: a recursion would overflow on what it looks for. */
function nestedBeyond(value: unknown, limit: number): boolean {
  let level = [value];

  for (let depth = 0; depth < limit && level.length > 0; depth += 1) {
    level = level.flatMap(childrenOf);
  }

  return level.some((item) => childrenOf(item).length > 0);
}

function childrenOf(value: unknown): unknown[] {
  return typeof value === 'object' && value !== null ? Object.values(value) : [];
}
