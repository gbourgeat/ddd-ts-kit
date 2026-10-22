import type { CitedName } from './cited-name';
import type { Citing } from './citing';
import type { Evidence } from './evidence';
import { judgeMember } from './judge-member';
import { judgePath } from './judge-path';
import { judgeSymbol } from './judge-symbol';
import type { Judgement } from './stale-citation';

/** What a cited name is to the code, by its kind. */
export function judgeCitation(name: CitedName, citing: Citing, evidence: Evidence): Judgement {
  if (name.kind === 'path') {
    return judgePath(name.cited, citing, evidence);
  }

  return name.kind === 'member' ? judgeMember(name.cited, citing, evidence) : judgeSymbol(name.cited, citing, evidence);
}
