import { KINDS } from '../generate/kinds';
import { kindHelp } from '../generate/kind-help';
import { kindsHelp } from '../generate/kinds-help';
import { VERSION } from '../version';
import { commandHelp } from './command-help';
import { commandHelpData } from './command-help-data';
import { kindAsked } from './kind-asked';
import { kindHelpText } from './kind-help-text';
import { referenceText } from './reference-text';
import { stdoutJson } from '../json/stdout-json';

/**
 * What `--help` answers, the alias of the command already resolved: the command it follows alone, the kind alone after
 * `generate <kind>`, the kinds as data for `generate --help --json`, and the whole reference without
 * a command, after `help`, or for a command the usage does not name.
 */
export function helpFor(argv: readonly string[]): string {
  const [command] = argv;

  const kind = kindAsked(argv);
  const json = argv.includes('--json');

  if (kind !== undefined) {
    return json ? stdoutJson(kindHelp(kind)) : kindHelpText(kind);
  }

  if (command === 'generate' && json) {
    return stdoutJson({ kinds: kindsHelp(KINDS) });
  }

  if (command === undefined) {
    return wholeHelp();
  }

  const data = json ? commandHelpData(command) : undefined;

  return data === undefined ? (commandHelp(command) ?? wholeHelp()) : stdoutJson(data);
}

function wholeHelp(): string {
  return `ddd-ts-kit ${VERSION}: bootstrap, scaffold and verify DDD and Clean Architecture TypeScript projects.

${referenceText()}`;
}
