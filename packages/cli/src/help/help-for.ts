import { KINDS } from '../generate/kinds';
import { kindHelp } from '../generate/kind-help';
import { kindsHelp } from '../generate/kinds-help';
import { VERSION } from '../version';
import { commandHelp } from './command-help';
import { kindAsked } from './kind-asked';
import { kindHelpText } from './kind-help-text';
import { referenceText } from './reference-text';

/**
 * What `--help` answers, `g` read as `generate`: the command it follows alone, the kind alone after
 * `generate <kind>`, the kinds as data for `generate --help --json`, and the whole reference without
 * a command, after `help`, or for a command the usage does not name. `help <command> ...` is
 * `<command> ... --help`.
 */
export function helpFor(asked: readonly string[]): string {
  const argv = asked[0] === 'g' ? ['generate', ...asked.slice(1)] : asked;
  const [command, ...rest] = argv;

  if (command === 'help' && rest.length > 0) {
    return helpFor(rest);
  }

  const kind = kindAsked(argv);
  const json = argv.includes('--json');

  if (kind !== undefined) {
    return json ? JSON.stringify(kindHelp(kind), null, 2) : kindHelpText(kind);
  }

  if (command === 'generate' && json) {
    return JSON.stringify({ kinds: kindsHelp(KINDS) }, null, 2);
  }

  return (command === undefined ? undefined : commandHelp(command)) ?? wholeHelp();
}

function wholeHelp(): string {
  return `ddd-ts-kit ${VERSION}: bootstrap, scaffold and verify DDD and Clean Architecture TypeScript projects.

${referenceText()}`;
}
