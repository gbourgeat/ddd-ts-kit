import type { Kind } from '../generate/kind';
import { kindHelp, type KindHelp } from '../generate/kind-help';
import { MODULE_OPTION } from '../generate/usage-of';
import { kindLine } from './kind-line';
import { EVERY_COMMAND } from './usage';
import { usageLinesOf } from './usage-lines-of';

/** What `ddd-ts-kit generate <kind> --help` prints: that kind alone, with the flags every kind takes. */
export function kindHelpText(kind: Kind): string {
  const help = kindHelp(kind);

  return [
    'Usage',
    `  ddd-ts-kit generate ${kindLine(kind)}`,
    '',
    help.summary,
    ...outsideLines(help),
    modulesLine(help),
    glossaryLine(help),
    '',
    `Every kind also takes ${everyKindFlags()}`,
    EVERY_COMMAND,
  ].join('\n');
}

/** Whether the kind writes outside its context, what and when. */
function outsideLines({ shared, sharedWhen }: KindHelp): string[] {
  return shared.length === 0
    ? ['Writes inside its context only.']
    : [
        `Writes outside its context: ${shared.join('; ')}.`,
        ...(sharedWhen === null ? [] : [`Only when ${sharedWhen}.`]),
      ];
}

function modulesLine({ writesInModules }: KindHelp): string {
  return writesInModules
    ? `Takes ${MODULE_OPTION}: writes its files into that module of the model of the context.`
    : 'Refuses --module: what it writes stays at the level of the context, or outside the contexts.';
}

function glossaryLine({ heldToGlossary }: KindHelp): string {
  return heldToGlossary
    ? 'Held to the glossary: a word of its names the glossary of the context does not define joins it with --term "<Term>=<meaning>", in the same command.'
    : 'Refuses --term: its names are not held to the glossary, they are read from the concept they serve or named by an earlier command.';
}

/** The flags the usage of `generate` gives every kind: what follows `<kind> ...` on its first line. */
function everyKindFlags(): string {
  const [first = ''] = usageLinesOf('generate');

  return /<kind> \.\.\. (.*?)\s+\(alias/.exec(first)?.[1] ?? '';
}
