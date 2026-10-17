import type { Project } from '../check/model/project.js';
import { readSlices } from '../progress/read-slices.js';
import { Workspace } from '../workspace/index.js';
import { openRows } from './open-rows.js';
import type { StaleCitation } from './stale-citation.js';
import { staleNamesSince } from './stale-names-since.js';

/**
 * What `verify-slice` tells of the design: the names the slice removes that a part of a row not
 * done still cites, the rows of this worker left out, and a part linked to no row included.
 */
export function citedRemovals(project: Project, since: string): StaleCitation[] {
  const slices = readSlices(new Workspace(project.root, false)) ?? [];

  return staleNamesSince(project, since, { rows: openRows(project.root, slices), unlinked: true });
}
