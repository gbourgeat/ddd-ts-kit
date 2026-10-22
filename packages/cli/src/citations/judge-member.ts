import { runGit } from '../commit/run-git';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import type { Citing } from './citing';
import type { Evidence } from './evidence';
import { judgeSymbol } from './judge-symbol';
import type { Judgement } from './stale-citation';

/** A commit as the pickaxe prints it: abbreviated hash, day, subject. */
const FORMAT = '--format=%h%x09%cs%x09%s';
const PLANNED: Judgement = { state: 'planned', candidates: [] };

/**
 * `Class.member` cited by a design. A class the code lacks is judged as the class. Of a class it
 * has, the member is present when the file of the class names it, removed when the last commit
 * that changed how often `member(` appears in that file took it out, planned otherwise.
 */
export function judgeMember(cited: string, citing: Citing, evidence: Evidence): Judgement {
  const [owner = '', member = ''] = cited.split('.');
  const files = evidence.index.names.get(owner);
  const { root, ref } = evidence;

  if (files === undefined) {
    return judgeSymbol(owner, citing, evidence);
  }

  if (ref === undefined) {
    return PLANNED;
  }

  const named = new RegExp(`(?<![\\w$])${escapeRegExp(member)}(?![\\w$])`);

  if (files.some((file) => named.test(runGit(root, ['show', `${ref}:./${file}`]) ?? ''))) {
    return { state: 'present', candidates: [] };
  }

  return pickaxe(member, files, { root, ref }) ?? PLANNED;
}

/** The last commit that changed how often `member(` appears in a file of the class: it took the member out. */
function pickaxe(member: string, files: readonly string[], at: { root: string; ref: string }): Judgement | undefined {
  for (const file of files) {
    const found = runGit(at.root, ['log', '-1', FORMAT, `-S${member}(`, at.ref, '--', file]) ?? '';
    const [commit = '', date = '', subject = ''] = found.trim().split('\t');

    if (commit !== '') {
      return { state: 'removed', removedBy: { commit, date, subject, path: file }, candidates: [] };
    }
  }

  return undefined;
}
