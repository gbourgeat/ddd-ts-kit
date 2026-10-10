export interface DeclaredRole {
  /** File suffix, without the extension: `handler` for `*.handler.ts`. */
  readonly suffix: string;
  /** Folders of the context, relative to it, the files of this suffix belong in. */
  readonly folders: readonly string[];
  /** The decorators one of which the exported class carries. */
  readonly decorators: readonly string[];
}
