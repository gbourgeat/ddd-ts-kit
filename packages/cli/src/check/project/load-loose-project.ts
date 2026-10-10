import fs from 'node:fs';
import path from 'node:path';
import { parseConfig } from '../../config/index.js';
import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { assembleProject } from './assemble-project.js';
import { isSource } from './is-source.js';
import { loadSourceFile } from './load-source-file.js';
import { walkDirectory } from './walk-directory.js';

/** Sources of arbitrary directories, without a project around them: for the rules that judge a file alone. */
export function loadLooseProject(root: string, directories: readonly string[]): Project {
  const config = parseConfig({});
  const files: SourceFile[] = [];

  for (const directory of directories) {
    walkDirectory(root, directory, (file, isDirectory) => {
      if (isDirectory || !isSource(file)) return;

      files.push(loadSourceFile(config, file, fs.readFileSync(path.join(root, file), 'utf8')));
    });
  }

  return assembleProject({ root, config, configText: '', files, contextEntries: [], contextsOnDisk: [] });
}
