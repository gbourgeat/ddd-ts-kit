import type { Config } from '../config.js';
import type { Workspace } from '../workspace.js';

export interface KindFlags {
  readonly classification?: string;
  readonly purpose?: string;
  readonly upstream: readonly string[];
  /** `<Term>=<meaning>` rows to add to the glossary of the context. */
  readonly term: readonly string[];
  readonly code?: string;
  readonly aggregate?: string;
  readonly method?: string;
  readonly path?: string;
  readonly command: boolean;
  readonly query: boolean;
  readonly version?: string;
  readonly allowName: boolean;
}

export interface KindRequest {
  readonly ws: Workspace;
  readonly config: Config;
  /** Positional arguments after the kind. */
  readonly args: readonly string[];
  readonly flags: KindFlags;
}

export interface Kind {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly usage: string;
  readonly summary: string;
  /** Positional arguments after the kind, by name; all are required. */
  readonly positionals: readonly string[];
  run(request: KindRequest): void;
}
