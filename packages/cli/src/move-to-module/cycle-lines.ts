import type { ClosedCycle, CycleStep } from './closed-cycles';

/** How many imports of a step that was there before the move are shown: the ones the move adds are all shown. */
const SHOWN = 3;

/**
 * A cycle a move closes, as a person reads it: its modules in order, then each step with the
 * imports that make it, file and line, the ones the move adds told apart from the ones there now.
 */
export function cycleLines(cycles: readonly ClosedCycle[]): string[] {
  return cycles.flatMap(({ modules, steps }) => [
    [...modules, modules[0]].join(' -> '),
    ...steps.flatMap((step) => stepLines(step).map((line) => `  ${line}`)),
  ]);
}

function stepLines({ from, to, added, imports }: CycleStep): string[] {
  const shown = added ? imports : imports.slice(0, SHOWN);
  const more = imports.length - shown.length;

  return [
    `${from} -> ${to}, ${added ? 'which the move adds' : 'which is there now'}:`,
    ...shown.map(({ file, line, imported }) => `  ${file}:${line} imports ${imported}`),
    ...(more > 0 ? [`  and ${more} more`] : []),
  ];
}
