import type { Config } from '../config';

/** The slice a staging plan is made for: the project, its context, and the shared files of the storage the generator wrote for it. */
export interface StagingScope {
  readonly config: Config;
  readonly context: string;
  /** The shared files of the storage whose every change belongs to the context, as `storageOfSlice` reads them; none by default. */
  readonly storage?: ReadonlySet<string>;
}
