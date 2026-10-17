import fs from 'node:fs';
import path from 'node:path';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import { CONFIG_FILE, type Config, readConfig } from '../config/index.js';
import { readWorkerFile } from '../worker/read-worker-file.js';
import type { WorkerFile } from '../worker/worker-file.js';
import type { MergeRepository } from './lost/merge-repository.js';
import { mergeRepositoryOf } from './lost/merge-repository-of.js';

/** Where a merge of the trunk happens: the project, its repository, its config when it has one, the worker of the worktree. */
export interface MergeContext {
  /** The project root: the kit's own folder, the scripts and the migrations are read from it. */
  readonly root: string;
  readonly repo: MergeRepository;
  /** Absent in a repository without the config of the kit: then nothing is regenerated and no migration replayed. */
  readonly config?: Config;
  readonly worker?: WorkerFile;
}

/** The context of the project at `root`, which may hold no config: a merge needs git only. */
export function mergeContextOf(root: string): MergeContext {
  const repo = mergeRepositoryOf(root);
  const config = fs.existsSync(path.join(root, CONFIG_FILE)) ? readConfig(root).config : undefined;
  const worker = readWorkerFile(path.join(root, WORKER_SCOPE_FILE));

  return { root, repo, ...(config === undefined ? {} : { config }), ...(worker === undefined ? {} : { worker }) };
}
