import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { loadSourceFile } from './load-source-file.js';

const readFromDisk = new WeakMap<Project, Map<string, SourceFile | undefined>>();

/**
 * The source at `file`: the one the project loaded, or, when only one file was loaded
 * (`check-file`), the file an import of it points to, read from disk once.
 */
export function sourceAt(project: Project, file: string): SourceFile | undefined {
  const loaded = project.files.find((candidate) => candidate.path === file);

  if (loaded !== undefined) {
    return loaded;
  }

  const cache = readFromDisk.get(project) ?? new Map<string, SourceFile | undefined>();

  readFromDisk.set(project, cache);

  if (!cache.has(file)) {
    cache.set(file, readSource(project, file));
  }

  return cache.get(file);
}

function readSource(project: Project, file: string): SourceFile | undefined {
  try {
    return loadSourceFile(project.config, file, fs.readFileSync(path.join(project.root, file), 'utf8'));
  } catch {
    return undefined;
  }
}
