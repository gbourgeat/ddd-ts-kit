import { firstFlaw } from '../check/canonical/first-flaw.js';
import { flawInContexts } from '../check/canonical/flaw-in-contexts.js';
import type { Citing } from './citing.js';
import type { Evidence } from './evidence.js';
import type { Removal } from './history.js';
import { removedByOf } from './removed-by-of.js';
import type { Judgement } from './stale-citation.js';

/**
 * A path cited by a design, under the source root or relative to a context (looked for in each
 * of `contexts`): present when a file is there, or under it for a directory; removed when the
 * history removed it; refused when the canonical tree has no place for it; planned otherwise.
 */
export function judgePath(cited: string, citing: Citing, evidence: Evidence): Judgement {
  const { config, index } = evidence;
  const relative = !cited.startsWith(`${config.sourceRoot}/`);
  const places = relative ? citing.contexts.map((context) => `${config.contextsDir}/${context}/${cited}`) : [cited];
  const files = [...index.files];

  if (
    places.some(
      (place) => index.files.has(place) || (place.endsWith('/') && files.some((file) => file.startsWith(place))),
    )
  ) {
    return { state: 'present', candidates: [] };
  }

  const removal = places.map((place) => removalOf(place, evidence)).find((found) => found !== undefined);

  if (removal !== undefined) {
    const to = removal.renamedTo;

    const candidates =
      to !== undefined && index.files.has(to) ? [{ name: to, file: to, evidence: 'renamed' as const }] : [];

    return { state: 'removed', removedBy: removedByOf(removal), candidates };
  }

  const flaw = relative ? flawInContexts(cited, citing.contexts, config) : refusedInContext(cited, evidence);

  return flaw === undefined
    ? { state: 'planned', candidates: [] }
    : { state: 'refused', refusal: flaw.message, candidates: [] };
}

/** The removal of a file, or the most recent one under a directory. */
function removalOf(place: string, { history }: Evidence): Removal | undefined {
  if (!place.endsWith('/')) {
    return history.removals.get(place);
  }

  return [...history.removals.values()].find((removal) => removal.path.startsWith(place));
}

function refusedInContext(cited: string, { config }: Evidence): ReturnType<typeof firstFlaw> {
  return cited.startsWith(`${config.contextsDir}/`) ? firstFlaw(cited, config) : undefined;
}
