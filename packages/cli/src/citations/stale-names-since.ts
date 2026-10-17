import type { Project } from '../check/model/project.js';
import { readSlices } from '../progress/read-slices.js';
import { Workspace } from '../workspace/index.js';
import { citationsOf } from './citations-of.js';
import { citedParts } from './cited-parts.js';
import { indexOfProject } from './index-of-project.js';
import { judgedCitations } from './judged-citations.js';
import { removalsSince } from './removals-since.js';
import { rowDocuments } from './row-documents.js';
import { type PartSelection, selectParts } from './select-parts.js';
import type { StaleCitation } from './stale-citation.js';

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
