import { Arguments } from '../commands/arguments';
import { GENERATE_OPTIONS, type GenerateOption, TEXT } from './generate-options';
import type { Kind } from './kind';
import { kindIn } from './kind-in';

/** The arguments of `generate` as it reads them: the positionals wherever the flags stand, the value of each flag. */
export function generateArguments(argv: readonly string[]): Arguments {
  return Arguments.parse(argv, optionsOf(kindIn(argv)));
}

/** One flag may be a switch for a kind and a text for another: `--command` of a route, `--command <UseCase>` of a job. */
function optionsOf(kind: Kind | undefined): Record<string, GenerateOption> {
  return { ...GENERATE_OPTIONS, ...Object.fromEntries((kind?.textFlags ?? []).map((flag) => [flag, TEXT])) };
}
