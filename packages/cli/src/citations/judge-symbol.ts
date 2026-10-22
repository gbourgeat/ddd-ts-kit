import { candidatesOf } from './candidates-of';
import type { Citing } from './citing';
import type { Evidence } from './evidence';
import { lineTime } from './line-time';
import { removalNaming } from './removal-naming';
import { removedByOf } from './removed-by-of';
import { sameStemNames } from './same-stem-names';
import type { Judgement } from './stale-citation';

const PLANNED: Judgement = { state: 'planned', candidates: [] };

/**
 * A class, an interface or a type cited by a design: present when the code declares it, removed
 * when a removed file gave it, similar when the code has a name of its stem that arrived after
 * the line citing it was written (the design could not mean it then), planned otherwise.
 */
export function judgeSymbol(cited: string, citing: Citing, evidence: Evidence): Judgement {
  if (evidence.index.names.has(cited)) {
    return { state: 'present', candidates: [] };
  }

  const removal = removalNaming(cited, evidence);

  if (removal !== undefined) {
    const candidates = candidatesOf({ cited, removal, contexts: citing.contexts }, evidence);

    return { state: 'removed', removedBy: removedByOf(removal), candidates };
  }

  if (evidence.ref === undefined) {
    return PLANNED;
  }

  const close = sameStemNames(cited, citing.contexts, evidence);
  const written = close.length === 0 ? undefined : lineTime(evidence.root, citing.document, citing.line);
  const later = close.filter((name) => written !== undefined && (evidence.history.added.get(name.file) ?? 0) > written);

  return later.length > 0 ? { state: 'similar', candidates: later } : PLANNED;
}
