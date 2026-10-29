import { readConfig } from '../config';
import { CliError } from '../cli-error';
import { findKind } from '../generate/find-kind';
import type { Kind, KindFlags } from '../generate/kind';
import type { LanguageProbe } from '../generate/language-probe';
import { KINDS } from '../generate/kinds';
import { placeGeneratedFiles } from '../generate/place-generated-files';
import { refreshDocs } from '../generate/refresh-docs';
import { refuseSharedWrites } from '../generate/refuse-shared-writes';
import { refuseUndeclaredFlags } from '../generate/refuse-undeclared-flags';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation';
import { MODULE_OPTION, usageOf } from '../generate/usage-of';
import { toName } from '../naming';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import { COMMON_FLAGS, GENERATE_OPTIONS as OPTIONS, TEXT, type GenerateOption } from './generate-options';
import { kindIn } from './kind-in';
import type { Io } from './io';
import type { Command } from './command';
import { printReport } from './print-report';
import { keepFlatPlatform } from '../platform-folders';

export const generateCommand: Command = (argv, io) => generate(argv, io);

/** `generate`, and with a probe of the language, the same command hearing its names instead of judging them. */
export function generate(argv: readonly string[], io: Io, language?: LanguageProbe): number {
  const asked = kindIn(argv);
  const args = Arguments.parse(argv, optionsOf(asked));
  const [kindName, ...rest] = args.positionals;
  const kind = requestedKind(kindName, rest);
  const root = args.projectRoot;
  const ws = new Workspace(root, args.flag('force'));
  const { config } = readConfig(root);

  keepFlatPlatform(ws, config);

  const flags = { ...flagsOf(args), ...(language === undefined ? {} : { language }) };

  refuseModuleOf(kind, flags);
  refuseUndeclaredFlags(kind, passedFlags(args, asked), COMMON_FLAGS);

  const context = kind.positionals[0] === 'context' ? toName(rest[0] ?? '').kebab : undefined;

  const stopPlacing = placeGeneratedFiles(ws, config, {
    context,
    module: flags.module,
    command: ['generate', ...argv].join(' '),
  });

  kind.run({ ws, config, args: rest, flags });
  stopPlacing();
  // A worker confined to its context leaves another context in the single declarations file of 0.84: the trunk moves it.
  refreshDocs(ws, args.flag('local-only') ? 'keep' : 'move', args.flag('local-only') ? 'context' : 'whole');

  if (args.flag('local-only')) {
    refuseSharedWrites(ws, config, kind.positionals[0] === 'context' ? toName(rest[0] ?? '').kebab : undefined, argv);
  } else {
    // A worker confined to its context leaves knip.json alone: the next command on the trunk, or `docs`, does this.
    stopIgnoringValidation(ws, config);
  }

  return printReport(io, args, ws.commit(args.flag('dry-run')));
}

/** One flag may be a switch for a kind and a text for another: `--command` of a route, `--command <UseCase>` of a job. */
function optionsOf(kind: Kind | undefined): Record<string, GenerateOption> {
  return { ...OPTIONS, ...Object.fromEntries((kind?.textFlags ?? []).map((flag) => [flag, TEXT])) };
}

/** The flags of `generate` given on the command line, by their name. */
function passedFlags(args: Arguments, kind: Kind | undefined): string[] {
  return Object.keys(optionsOf(kind)).filter(
    (key) => args.text(key) !== undefined || args.flag(key) || args.many(key).length > 0,
  );
}

function requestedKind(name: string | undefined, rest: readonly string[]): Kind {
  const kind = name === undefined ? undefined : findKind(name);

  if (kind === undefined) {
    throw new CliError(
      name === undefined ? 'generate needs a kind.' : `Unknown kind "${name}".`,
      `Use one of: ${KINDS.map((candidate) => candidate.name).join(', ')}.`,
    );
  }

  const optional = kind.optionalPositionals ?? [];

  if (rest.length < kind.positionals.length || rest.length > kind.positionals.length + optional.length) {
    throw new CliError(
      `${kind.name} expects ${expectedArguments(kind.positionals, optional)}.`,
      `Usage: ddd-ts-kit generate ${usageOf(kind)}`,
    );
  }

  return kind;
}

/** `--module` given to a kind that writes nothing a module of the model divides: it would have no effect. */
function refuseModuleOf(kind: Kind, flags: KindFlags): void {
  if (flags.module === undefined || kind.writesInModules) {
    return;
  }

  throw new CliError(
    `generate ${kind.name} writes nothing into a module of the model: what it writes stays at the level of the context, or outside the contexts, so --module ${flags.module} would have no effect.`,
    `Run it again without --module. The kinds that take it show ${MODULE_OPTION} in their usage (\`ddd-ts-kit generate --help --json\`, writesInModules).`,
  );
}

function expectedArguments(required: readonly string[], optional: readonly string[]): string {
  const named = [...required, ...optional.map((name) => `[${name}]`)].join(', ');

  return optional.length === 0
    ? `${required.length} argument(s): ${named}`
    : `${required.length} to ${required.length + optional.length} arguments: ${named}`;
}

/** The flags of `generate` that take one word. */
const TEXT_FLAGS = [
  'classification',
  'purpose',
  'preset',
  'code',
  'aggregate',
  'method',
  'path',
  'version',
  'permission',
  'grant',
  'deviation',
  'reason',
  'number',
  'name',
  'kind',
  'every',
  'cron',
  'phase',
  'event',
  'group',
  'prefix',
  'role',
  'cache',
  'module',
  'personal',
  'subject',
  'birth',
  'erasure',
  'retention',
] as const;

function flagsOf(args: Arguments): KindFlags {
  const timeZone = args.text('time-zone');
  const commandName = args.text('command');

  return {
    ...args.texts(TEXT_FLAGS),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(commandName === undefined ? {} : { commandName }),
    upstream: args.many('upstream'),
    term: args.many('term'),
    value: args.many('value'),
    transition: args.many('transition'),
    ...switchesOf(args),
  };
}

type Switch =
  | 'command'
  | 'query'
  | 'allowName'
  | 'public'
  | 'tenantScoped'
  | 'search'
  | 'decorators'
  | 'global'
  | 'mapper'
  | 'serializer'
  | 'eventSourced'
  | 'creates';

function switchesOf(args: Arguments): Pick<KindFlags, Switch> {
  return {
    command: args.flag('command'),
    query: args.flag('query'),
    allowName: args.flag('allow-name'),
    public: args.flag('public'),
    tenantScoped: args.flag('tenant-scoped'),
    search: args.flag('search'),
    decorators: args.flag('decorators'),
    global: args.flag('global'),
    mapper: args.flag('mapper'),
    serializer: args.flag('serializer'),
    eventSourced: args.flag('event-sourced'),
    creates: args.flag('creates'),
  };
}
