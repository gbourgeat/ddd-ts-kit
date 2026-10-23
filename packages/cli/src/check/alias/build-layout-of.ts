import type { BuildLayout } from '../../alias';
import type { Project } from '../model/project';
import { compilerOptionsOf } from './compiler-options-of';

/** Where a tsconfig of the project reads and writes; nothing when the file is absent or unreadable. */
export function buildLayoutOf(project: Pick<Project, 'root'>, file: string): BuildLayout | undefined {
  const options = compilerOptionsOf(project, file);

  if (options === undefined) {
    return undefined;
  }

  const { rootDir, outDir } = options;

  return { rootDir: typeof rootDir === 'string' ? rootDir : '.', outDir: typeof outDir === 'string' ? outDir : '.' };
}
