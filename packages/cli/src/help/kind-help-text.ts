import type { Kind } from '../generate/kind';
import { kindHelp } from '../generate/kind-help';
import { MODULE_OPTION } from '../generate/usage-of';
import { kindLine } from './kind-line';
import { EVERY_COMMAND } from './usage';
import { usageLinesOf } from './usage-lines-of';

/** What `ddd-ts-kit generate <kind> --help` prints: that kind alone, with the flags every kind takes. */
export function kindHelpText(kind: Kind): string {
  const { summary, shared, sharedWhen, writesInModules } = kindHelp(kind);

  const outside =
    shared.length === 0
      ? ['Writes inside its context only.']
      : [
          `Writes outside its context: ${shared.join('; ')}.`,
          ...(sharedWhen === null ? [] : [`Only when ${sharedWhen}.`]),
        ];

  const modules = writesInModules
    ? `Takes ${MODULE_OPTION}: writes its files into that module of the model of the context.`
    : 'Refuses --module: what it writes stays at the level of the context, or outside the contexts.';

  return [
    'Usage',
    `  ddd-ts-kit generate ${kindLine(kind)}`,
    '',
    summary,
    ...outside,
    modules,
    '',
    `Every kind also takes ${everyKindFlags()}`,
    EVERY_COMMAND,
  ].join('\n');
}

/** The flags the usage of `generate` gives every kind: what follows `<kind> ...` on its first line. */
function everyKindFlags(): string {
  const [first = ''] = usageLinesOf('generate');

  return /<kind> \.\.\. (.*?)\s+\(alias/.exec(first)?.[1] ?? '';
}
