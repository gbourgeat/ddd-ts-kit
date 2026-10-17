import type { WorkerFile } from '../worker/worker-file.js';
import type { MergeRepository } from './lost/merge-repository.js';

/** What the base of a merge of the trunk is looked for with. */
export interface BaseQuery {
  /** The project root: patches are compared on the project, without the files tools write again. */
  readonly root: string;
  readonly repo: MergeRepository;
  readonly head: string;
  /** The commit of the trunk. */
  readonly trunk: string;
  readonly since?: string;
  readonly worker?: WorkerFile;
}
