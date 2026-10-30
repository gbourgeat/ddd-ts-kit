import type { ModulesByContext } from '../model-modules';

/** Where the contexts are, the modules of the model each declares, and where the platform is when the reader knows it. */
export interface DerivedTree {
  readonly contextsDir: string;
  readonly modules: ModulesByContext;
  /** Unknown to a merge, which reads the repository without the config: the files of the platform are then not covered. */
  readonly platformDir?: string;
}
