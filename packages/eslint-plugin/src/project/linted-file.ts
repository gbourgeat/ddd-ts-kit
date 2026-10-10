import type { Location } from './location.js';
import type { Config } from './config.js';

export interface Project {
  readonly root: string;
  readonly config: Config;
}

export interface LintedFile extends Project {
  /** Posix path relative to the project root. */
  readonly path: string;
  readonly location: Location;
  readonly isTest: boolean;
}
