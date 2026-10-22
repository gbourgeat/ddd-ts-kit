import type { AliasRoot } from '../../alias';
import type { Project } from '../model/project';
import type { Report } from '../model/report';

/** What each part of `imports/alias-declared` looks at: the project, its aliased trees and where to report. */
export interface Inspected {
  readonly project: Project;
  readonly roots: readonly AliasRoot[];
  readonly report: Report;
}
