/** The directories no walk of a project enters: what a tool writes, never a source of the project. */
export const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', '.git', '.worktrees']);
