import fs from 'node:fs';
import path from 'node:path';
import { readConfig, type Config } from '../../config';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { assembleProject } from './assemble-project';
import { gitIgnored, type Ignored } from './git-ignored';
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
  // A directory of the config out of the project is read as its default here, and reported by config/valid.
  const { config, text: configText } = readConfig(root, { leaving: 'default' });

  const tree =
    options.onlyFile === undefined
      ? walkTree(root, config)
      : oneFile(root, config, { file: options.onlyFile, text: options.text });

  return assembleProject({ root, config, configText, ...tree });
}

/** The one source the editor hook asks about: its text on disk, or the text about to be written. */
function oneFile(root: string, config: Config, { file, text }: { file: string; text: string | undefined }): Tree {
  const source = text === undefined ? readSource(root, config, file) : loadSourceFile(config, file, text);

  return { files: [source], contextEntries: [], contextsOnDisk: [] };
}

function walkTree(root: string, config: Config): Tree {
  const files: SourceFile[] = [];
  const contextEntries: string[] = [];
  const contextsOnDisk: string[] = [];

  const visit = (file: string, isDirectory: boolean): void => {
    if (isUnder(file, config.contextsDir)) {
      contextEntries.push(isDirectory ? `${file}/` : file);
    }

    if (isDirectory && path.posix.dirname(file) === config.contextsDir) {
      contextsOnDisk.push(path.posix.basename(file));
    }

    if (!isDirectory && isSource(file)) {
      files.push(readSource(root, config, file));
    }
  };

  walkDirectory({ root, directory: config.sourceRoot, skip: notInTheTree(root, config) }, visit);

  return { files, contextEntries, contextsOnDisk };
}

/**
 * The tree under the source root is what git sees: an entry git ignores is not read, nor a
 * dot-directory under the contexts directory, which a tool writes and no context declares.
 */
function notInTheTree(root: string, { sourceRoot, contextsDir }: Config): Ignored {
  const ignored = gitIgnored(root, sourceRoot);

  return (file, isDirectory) =>
    ignored(file, isDirectory) ||
    (isDirectory && file !== contextsDir && isUnder(file, contextsDir) && path.posix.basename(file).startsWith('.'));
}

function readSource(root: string, config: Config, file: string): SourceFile {
  return loadSourceFile(config, file, fs.readFileSync(path.join(root, file), 'utf8'));
}
