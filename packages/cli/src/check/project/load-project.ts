import fs from 'node:fs';
import path from 'node:path';
import { readConfig, type Config } from '../../config';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { assembleProject } from './assemble-project';
import { isSource } from './is-source';
import { isUnder } from './is-under';
import { loadSourceFile } from './load-source-file';
import { walkDirectory } from './walk-directory';

export interface ProjectOptions {
  /** Load only this source instead of walking the tree (editor hook path). */
  readonly onlyFile?: string;
  /** The text to judge for that file instead of what is on disk: what a session is about to write. */
  readonly text?: string | undefined;
}

type Tree = Pick<Project, 'files' | 'contextEntries' | 'contextsOnDisk'>;

export function loadProject(root: string, options: ProjectOptions = {}): Project {
  const { config, text: configText } = readConfig(root);

  const tree =
    options.onlyFile === undefined ? walkTree(root, config) : oneFile(root, config, options.onlyFile, options.text);

  return assembleProject({ root, config, configText, ...tree });
}

function oneFile(root: string, config: Config, file: string, text: string | undefined): Tree {
  const source = text === undefined ? readSource(root, config, file) : loadSourceFile(config, file, text);

  return { files: [source], contextEntries: [], contextsOnDisk: [] };
}

function walkTree(root: string, config: Config): Tree {
  const files: SourceFile[] = [];
  const contextEntries: string[] = [];
  const contextsOnDisk: string[] = [];

  walkDirectory(root, config.sourceRoot, (file, isDirectory) => {
    if (isUnder(file, config.contextsDir)) {
      contextEntries.push(isDirectory ? `${file}/` : file);
    }

    if (isDirectory && path.posix.dirname(file) === config.contextsDir) {
      contextsOnDisk.push(path.posix.basename(file));
    }

    if (!isDirectory && isSource(file)) {
      files.push(readSource(root, config, file));
    }
  });

  return { files, contextEntries, contextsOnDisk };
}

function readSource(root: string, config: Config, file: string): SourceFile {
  return loadSourceFile(config, file, fs.readFileSync(path.join(root, file), 'utf8'));
}
