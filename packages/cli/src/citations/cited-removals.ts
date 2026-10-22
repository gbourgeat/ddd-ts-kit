import type { Project } from '../check/model/project';
import { readSlices } from '../progress/read-slices';
import { Workspace } from '../workspace';
import { openRows } from './open-rows';
import type { StaleCitation } from './stale-citation';
import { staleNamesSince } from './stale-names-since';

/**
 * What `verify-slice` tells of the design: the names the slice removes that a part of a row not
 * done still cites, the rows of this worker left out, and a part linked to no row included.
 */
export function citedRemovals(project: Project, since: string): StaleCitation[] {
  const slices = readSlices(new Workspace(project.root, false)) ?? [];

  return staleNamesSince(project, since, { rows: openRows(project.root, slices), unlinked: true });
}
