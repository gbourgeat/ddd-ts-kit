import type { Project } from '../check/model/project';
import { readSlices } from '../progress/read-slices';
import { Workspace } from '../workspace';
import { citationsOf } from './citations-of';
import { citedParts } from './cited-parts';
import { indexOfProject } from './index-of-project';
import { judgedCitations } from './judged-citations';
import { removalsSince } from './removals-since';
import { rowDocuments } from './row-documents';
import { type PartSelection, selectParts } from './select-parts';
import type { StaleCitation } from './stale-citation';

/**
 * The names a change removes or renames, since it left `since`, that the design of the parts of
 * a selection still cites, judged against the working tree the checker loaded: what the change
 * leaves for the conductor to correct in the documents.
 */
export function staleNamesSince(project: Project, since: string, selection: PartSelection): StaleCitation[] {
  const { root, config } = project;
  const history = removalsSince(root, since, config.sourceRoot);

  if (history.removals.size === 0) {
    return [];
  }

  const slices = readSlices(new Workspace(root, false)) ?? [];
  const citations = citationsOf(citedParts(selectParts(rowDocuments(root, slices), selection), slices, project));
  const { stale } = judgedCitations(citations, { root, config, index: indexOfProject(project), history });

  return stale.filter((citation) => citation.state === 'removed');
}
