import type { FileMove } from '../file-moves';
import type { ClosedCycle } from './closed-cycles';

/** The cycles a move closes with each file named where it is before the move: what a person can open while nothing is written. */
export function beforeTheMove(cycles: readonly ClosedCycle[], moved: readonly FileMove[]): ClosedCycle[] {
  const origin = new Map(moved.map(({ from, to }) => [to, from]));
  const now = (file: string): string => origin.get(file) ?? file;

  return cycles.map(({ modules, steps }) => ({
    modules,
    steps: steps.map((step) => ({
      ...step,
      imports: step.imports.map((one) => ({ ...one, file: now(one.file), imported: now(one.imported) })),
    })),
  }));
}
