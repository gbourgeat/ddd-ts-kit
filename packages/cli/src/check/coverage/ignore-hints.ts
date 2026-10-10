import { commentLines } from '../comments/comment-lines.js';
import { ADR_DIRECTORY } from '../governance/adr-directory.js';
import type { DecisionRecords } from '../governance/decision-records.js';
import { referencedRecord } from '../governance/referenced-record.js';
import type { Finding } from '../model/finding.js';
import type { SourceFile } from '../model/source-file.js';

/** A comment that tells the coverage provider to leave code out of the measure: `v8 ignore next`, `istanbul ignore if`, `c8 ignore start`. */
const HINT = /\b((?:v8|c8|istanbul)\s+ignore\b(?:\s+(?:next|start|stop|if|else|file))?)/;

/** The ignore hints of a production source that no decision record covers: each one lowers what the threshold measures. */
export function ignoreHints(file: SourceFile, records: DecisionRecords): Finding[] {
  if (file.isTest) {
    return [];
  }

  return commentLines(file).flatMap((comment) => {
    const hint = comment.sample ? undefined : HINT.exec(comment.text)?.[1];

    if (hint === undefined || isRecorded(comment.text, records)) {
      return [];
    }

    return [
      {
        line: comment.line,
        message: `The comment "${hint}" hides code from the coverage measure and points to no decision record.`,
        fix: `Remove the comment and test the code, or delete the code if nothing can reach it; if the exclusion is deliberate, write ${ADR_DIRECTORY}/NNNN-<slug>.md (what is left out, why no test can reach it, condition for removing it) and end the comment with \`-- ADR-NNNN: <reason>\`.`,
      },
    ];
  });
}

function isRecorded(text: string, records: DecisionRecords): boolean {
  const reason = text.split('--').slice(1).join('--');
  const number = referencedRecord(reason);

  return number !== undefined && records.has(number);
}
