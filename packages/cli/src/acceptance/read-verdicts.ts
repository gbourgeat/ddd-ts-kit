import type { Workspace } from '../workspace/index.js';
import type { Verdict } from './verdict.js';
import { VERDICTS_DIR } from './verdicts-dir.js';

const FIELD = /^(Story|Subject|Fingerprint|Verdict|Reason):\s*(.*)$/;

/**
 * The verdicts on the changes of a story since its lock, read from `test/acceptance/verdicts/`:
 * each a Markdown file with the lines `Story:`, `Subject:`, `Fingerprint:`, `Verdict: amend` or
 * `refuse`, and `Reason:`. A file missing one of them is not a verdict.
 */
export function readVerdicts(ws: Workspace, story: string): Verdict[] {
  return ws
    .list(VERDICTS_DIR)
    .filter((name) => name.endsWith('.md'))
    .flatMap((name) => verdictIn(`${VERDICTS_DIR}/${name}`, ws.read(`${VERDICTS_DIR}/${name}`) ?? '', story));
}

/** The verdict a file holds on the story, or none. */
function verdictIn(file: string, text: string, story: string): Verdict[] {
  const fields = fieldsOf(text);
  const verdict = fields.get('Verdict');
  const subject = fields.get('Subject');
  const fingerprint = fields.get('Fingerprint');

  if (
    fields.get('Story')?.toLowerCase() !== story.toLowerCase() ||
    subject === undefined ||
    fingerprint === undefined
  ) {
    return [];
  }

  return verdict === 'amend' || verdict === 'refuse'
    ? [{ file, story, subject, fingerprint, verdict, reason: fields.get('Reason') ?? '' }]
    : [];
}

function fieldsOf(text: string): Map<string, string> {
  return new Map(
    text.split('\n').flatMap((line) => {
      const [, key, value] = FIELD.exec(line.trim()) ?? [];

      return key === undefined || value === undefined ? [] : [[key, value.trim().replace(/^`|`$/g, '')] as const];
    }),
  );
}
