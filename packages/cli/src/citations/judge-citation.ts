import type { CitedName } from './cited-name.js';
import type { Citing } from './citing.js';
import type { Evidence } from './evidence.js';
import { judgeMember } from './judge-member.js';
import { judgePath } from './judge-path.js';
import { judgeSymbol } from './judge-symbol.js';
import type { Judgement } from './stale-citation.js';

/** What a cited name is to the code, by its kind. */
export function judgeCitation(name: CitedName, citing: Citing, evidence: Evidence): Judgement {
  if (name.kind === 'path') {
    return judgePath(name.cited, citing, evidence);
  }

  return name.kind === 'member' ? judgeMember(name.cited, citing, evidence) : judgeSymbol(name.cited, citing, evidence);
}
