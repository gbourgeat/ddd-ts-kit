import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE } from './config-file.js';
import { parseConfig } from './parse-config.js';
import type { Project } from './linted-file.js';

const projectsByDirectory = new Map<string, Project | undefined>();

/** Walks up from `directory` to the nearest `ddd-ts-kit.config.json`; every directory visited is remembered. */
export function findProject(directory: string): Project | undefined {
  if (projectsByDirectory.has(directory)) return projectsByDirectory.get(directory);

  const found = readProject(directory) ?? findInParent(directory);

  projectsByDirectory.set(directory, found);

  return found;
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
