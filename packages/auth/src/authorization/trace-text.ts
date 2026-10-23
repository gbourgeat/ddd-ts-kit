import type { TraceStep } from './trace-step.js';

const MARKS: Readonly<Record<TraceStep['answer'], string>> = { yes: ' ', no: 'x', cut: '!' };
const INDENT = '  ';

/** The trace as a reader sees it: one line per step, indented by depth, `x` before what does not hold, `!` before what was cut. */
export function traceText(trace: readonly TraceStep[]): string {
  return trace.map((step) => `${MARKS[step.answer]} ${INDENT.repeat(step.depth)}${step.text}`).join('\n');
}
