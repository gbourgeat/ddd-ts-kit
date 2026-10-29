import type { TodoLocation } from './todo-location';

/** What a command wrote, or would write, and what is left to decide. */
export interface WorkspaceReport {
  readonly created: string[];
  readonly updated: string[];
  /** Derived files removed because nothing derives them any more. */
  readonly deleted: string[];
  /** Files left as they are: the ones that exist (unless --force) and the unwritable ones. */
  readonly skipped: string[];
  /** Files that exist and are the team's once written: left as they are, --force included. */
  readonly kept: string[];
  /** Files this command could not write where it ran, such as paths the sandbox of an agent protects; also in `skipped`. */
  readonly unwritable: string[];
  readonly next: string[];
  readonly todos: TodoLocation[];
  readonly notes: string[];
}
