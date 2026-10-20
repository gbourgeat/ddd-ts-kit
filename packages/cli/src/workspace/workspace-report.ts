import type { TodoLocation } from './todo-location.js';

/** What a command wrote, or would write, and what is left to decide. */
export interface WorkspaceReport {
  readonly created: string[];
  readonly updated: string[];
  /** Derived files removed because nothing derives them any more. */
  readonly deleted: string[];
  readonly skipped: string[];
  readonly next: string[];
  readonly todos: TodoLocation[];
  readonly notes: string[];
}
