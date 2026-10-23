import { ADR_DIRECTORY } from '../../check/governance/adr-directory';
import { CliError } from '../../cli-error';
import type { Workspace } from '../../workspace';

/**
 * The number of the new decision record of the project, on four digits: the one asked with
 * `--number`, when it is free in `docs/adr/`, otherwise one after the highest. Teams that work in
 * parallel number by block (`0401`, `0701`), so the highest plus one is not theirs to take.
 */
export function adrNumber(ws: Workspace, asked: string | undefined): string {
  const taken = ws.list(ADR_DIRECTORY).map((file) => Number(/^(\d+)-/.exec(file)?.[1] ?? '0'));

  if (asked === undefined) {
    return padded(Math.max(0, ...taken) + 1);
  }

  const number = Number(asked);

  if (!/^\d+$/.test(asked) || number === 0) {
    throw new CliError(
      `--number ${asked} is not the number of a decision record.`,
      'Pass a positive whole number, for example --number 401: it is written on four digits, 0401.',
    );
  }

  if (taken.includes(number)) {
    throw new CliError(
      `ADR-${padded(number)} already exists in ${ADR_DIRECTORY}/.`,
      'Pass a free number with --number, or leave it out to take the one after the highest.',
    );
  }

  return padded(number);
}

function padded(number: number): string {
  return String(number).padStart(4, '0');
}
