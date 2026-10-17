import { formatCheck } from '../check/engine/format-check.js';
import type { ScriptRun } from './script-run.js';
import type { SliceVerification } from './slice-verification.js';

/** The verification of a slice as a short report: each step, what failed with its cause, then what to do next. */
export function formatSliceVerification(verification: SliceVerification): string {
  const { check, context, since } = verification;
  const checked = check.errorCount === 0 ? 'ok' : `${check.errorCount} error(s)`;

  return [
    ...step('regenerate', verification.regenerate),
    `check (changed since ${since}): ${checked}${check.warningCount > 0 ? `, ${check.warningCount} warning(s)` : ''}`,
    ...(check.violations.length > 0 ? indented(formatCheck(check, 'text')) : []),
    ...step(`tests of ${context}`, verification.tests),
    ...nearTheLimitLines(verification),
    ...nextLines(verification),
    ...leftOutLines(verification),
    ...citedRemovalLines(verification),
  ].join('\n');
}

function step(name: string, run: ScriptRun): string[] {
  return run.ok ? [`${name}: ok`] : [`${name}: failed`, ...indented(run.output)];
}

function nearTheLimitLines({ nearTheLimit }: SliceVerification): string[] {
  return nearTheLimit.length === 0
    ? []
    : [
        'near the 350-line limit: the next change to them starts by moving a concept out',
        ...nearTheLimit.map(({ file, lines }) => `  ${file} (${lines})`),
      ];
}

function nextLines({ ok, toStage, context }: SliceVerification): string[] {
  if (!ok) {
    return ['next: fix the causes above, then run verify-slice again'];
  }

  return toStage.length === 0
    ? ['next: nothing to commit']
    : [
        `next: commit the slice, staging these paths one by one: feat(${context}): <the slice in business words>`,
        ...toStage.map((file) => `  ${file}`),
      ];
}

/** Said whether the slice passed or not: an agent must never sweep these into its commit. */
function leftOutLines({ leftOut }: SliceVerification): string[] {
  return leftOut.length === 0
    ? []
    : [
        'left out: changed or new, but not part of the slice; never stage them with it (a person decides about them)',
        ...leftOut.map((file) => `  ${file}`),
      ];
}

/** Said whether the slice passed or not: the documents are corrected by the conductor, never by the slice. */
function citedRemovalLines({ citedRemovals }: SliceVerification): string[] {
  return citedRemovals.length === 0
    ? []
    : [
        'cited by the design of rows not done: names this slice removes (tell the conductor, as notes of your report)',
        ...citedRemovals.map(({ cited, candidates, document, line, rows }) => {
          const now =
            candidates.length === 0 ? '' : ` (now ${candidates.map((candidate) => candidate.name).join(' or ')})`;

          const owners = rows.length === 0 ? '' : ` (${rows.map((id) => `#${id}`).join(', ')})`;

          return `  \`${cited}\`${now}: ${document}:${line}${owners}`;
        }),
      ];
}

function indented(text: string): string[] {
  return text.split('\n').map((line) => `    ${line}`);
}
