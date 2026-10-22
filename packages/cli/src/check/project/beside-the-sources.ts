import fs from 'node:fs';
import path from 'node:path';
import { FIXED_ALIAS_ROOTS } from '../../alias';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { isSource } from './is-source';
import { loadSourceFile } from './load-source-file';
import { walkDirectory } from './walk-directory';

/** The trees `check` does not walk for the other rules: their files are read for their imports only. */
const BESIDE_THE_SOURCES = [FIXED_ALIAS_ROOTS.test.directory, FIXED_ALIAS_ROOTS.scripts.directory];

/** The TypeScript sources of the tests and of the scripts, which live next to the source root. */
export function besideTheSources(project: Pick<Project, 'root' | 'config'>): SourceFile[] {
  const files: SourceFile[] = [];

  for (const directory of BESIDE_THE_SOURCES) {
    walkDirectory(project.root, directory, (file, isDirectory) => {
      if (!isDirectory && isSource(file)) {
        files.push(loadSourceFile(project.config, file, fs.readFileSync(path.join(project.root, file), 'utf8')));
      }
    });
  }

  return files;
}
