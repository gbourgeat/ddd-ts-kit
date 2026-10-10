import type { Project } from './project.js';
import type { Violation } from './violation.js';

export interface Rule {
  readonly id: string;
  readonly description: string;
  /** `file` rules need one source at a time and run in `check-file`; `project` rules need the tree. */
  readonly scope: 'file' | 'project';
  run(project: Project): Violation[];
  /** For a `file` rule, the part of the judgment that needs the whole tree: `check-file` skips it. */
  acrossProject?(project: Project): Violation[];
}
