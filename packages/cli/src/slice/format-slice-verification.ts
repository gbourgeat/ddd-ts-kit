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

function indented(text: string): string[] {
  return text.split('\n').map((line) => `    ${line}`);
}
