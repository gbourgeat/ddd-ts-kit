import type { ModulesByContext } from '../../model-modules/index.js';

/** Where a merge is read: the repository, and the project inside it. */
export interface MergeRepository {
  /** The top of the working tree of the repository: every path of a merge is relative to it. */
  readonly top: string;
  /** The path of the project inside the repository, empty at its top, else ending with `/`. */
  readonly prefix: string;
  /** The folder of the bounded contexts, relative to the project. */
  readonly contextsDir: string;
  /** The modules of the model each context declares: their generated declarations are derived files too. */
  readonly modules: ModulesByContext;
}
