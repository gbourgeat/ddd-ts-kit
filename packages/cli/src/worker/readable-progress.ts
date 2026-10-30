import { type Config, readConfig } from '../config';
import { progressOf } from './progress-of';
import type { WorkerFile } from './worker-file';
import type { WorkerProgress } from './worker-progress';

/** Where the worker at `project` stands; undefined when its config cannot be read. */
export function readableProgress(project: string, scope: WorkerFile): WorkerProgress | undefined {
  const config = configOf(project);

  return config === undefined ? undefined : progressOf({ project, config }, scope);
}

function configOf(project: string): Config | undefined {
  try {
    return readConfig(project).config;
  } catch {
    return undefined;
  }
}
