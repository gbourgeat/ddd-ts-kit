import path from 'node:path';
import type { Candidate, RemovedBy, StaleCitation } from './stale-citation.js';

const EVIDENCE: Readonly<Record<Candidate['evidence'], string>> = {
  renamed: 'renamed',
  'added-with-removal': 'added with the removal',
  'same-stem': 'same stem',
};

/** A reported name as one line: where it is cited, what the code did with it, and what the code has instead. */
export function citationLine(citation: StaleCitation, base: string): string {
  return `${citation.document}:${citation.line} \`${citation.cited}\`: ${whatItIs(citation, base)}`;
}

function whatItIs(citation: StaleCitation, base: string): string {
  const { state, candidates, removedBy } = citation;

  if (state === 'refused') {
    return `a place the canonical tree refuses: ${citation.refusal ?? ''}`;
  }

  if (state === 'similar') {
    const close = candidates.map(({ name, file }) => `\`${name}\` (${roleOf(file)})`).join(', ');

    return `not on ${base} and never was; ${base} has ${close}: build on it if the design means it`;
  }

  return candidates.length === 0
    ? removalOf(removedBy)
    : `${removalOf(removedBy)}; now ${candidates.map(successor).join('; or ')}`;
}

function removalOf(removedBy: RemovedBy | undefined): string {
  const { commit, date = '', subject = '' } = removedBy ?? {};

  return commit === undefined ? 'removed by this change' : `removed by ${commit} (${date}, "${subject}")`;
}

function successor({ name, file, evidence }: Candidate): string {
  return name === file ? `\`${file}\` (${EVIDENCE[evidence]})` : `\`${name}\`, ${file} (${EVIDENCE[evidence]})`;
}

/** The role a file plays, from its suffix: `port` for `refund-basis-reader.port.ts`. */
function roleOf(file: string): string {
  const [, suffix, extension] = path.posix.basename(file).split('.');

  return suffix !== undefined && extension !== undefined ? suffix.replaceAll('-', ' ') : 'file';
}
