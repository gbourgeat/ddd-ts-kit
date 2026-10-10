import type { TodoLocation } from './todo-location.js';

/** What a command wrote, or would write, and what is left to decide. */
export interface WorkspaceReport {
  readonly created: string[];
  readonly updated: string[];
  readonly skipped: string[];
  readonly next: string[];
  readonly todos: TodoLocation[];
  readonly notes: string[];
}
