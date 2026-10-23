import { readConfig } from '../config';
import { CliError } from '../cli-error';
import { findKind } from '../generate/find-kind';
import type { Kind, KindFlags } from '../generate/kind';
import { KINDS } from '../generate/kinds';
import { placeGeneratedFiles } from '../generate/place-generated-files';
import { refreshDocs } from '../generate/refresh-docs';
import { refuseSharedWrites } from '../generate/refuse-shared-writes';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation';
import { toName } from '../naming';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import { printReport } from './print-report';
import { keepFlatPlatform } from '../platform-folders';

export const generateCommand: Command = (argv, io) => {
  const asked = findKind(argv.find((argument) => !argument.startsWith('-')) ?? '');
  const args = Arguments.parse(argv, optionsOf(asked));
  const [kindName, ...rest] = args.positionals;
  const kind = requestedKind(kindName, rest);
  const root = args.projectRoot;
  const ws = new Workspace(root, args.flag('force'));
  const { config } = readConfig(root);

  keepFlatPlatform(ws, config);

  const flags = flagsOf(args);
  const context = kind.positionals[0] === 'context' ? toName(rest[0] ?? '').kebab : undefined;

  const stopPlacing = placeGeneratedFiles(ws, config, {
    context,
    module: flags.module,
    command: ['generate', ...argv].join(' '),
  });

  kind.run({ ws, config, args: rest, flags });
  stopPlacing();
  // A worker confined to its context leaves another context in the single declarations file of 0.84: the trunk moves it.
  refreshDocs(ws, args.flag('local-only') ? 'keep' : 'move');

  if (args.flag('local-only')) {
    refuseSharedWrites(ws, config, kind.positionals[0] === 'context' ? toName(rest[0] ?? '').kebab : undefined);
  } else {
    // A worker confined to its context leaves knip.json alone: the next command on the trunk, or `docs`, does this.
    stopIgnoringValidation(ws, config);
  }

  printReport(io, args, ws.commit(args.flag('dry-run')));

  return 0;
};

const TEXT = { type: 'string' } as const;
const SWITCH = { type: 'boolean', default: false } as const;
const TEXTS = { type: 'string', multiple: true } as const;

/** Every flag a kind may take; each kind reads the ones it knows. */
const OPTIONS = {
  classification: TEXT,
  purpose: TEXT,
  preset: TEXT,
  upstream: TEXTS,
  term: TEXTS,
  value: TEXTS,
  transition: TEXTS,
  code: TEXT,
  aggregate: TEXT,
  method: TEXT,
  path: TEXT,
  command: SWITCH,
  query: SWITCH,
  version: TEXT,
  'allow-name': SWITCH,
  permission: TEXT,
  grant: TEXT,
  public: SWITCH,
  'tenant-scoped': SWITCH,
  search: SWITCH,
  kind: TEXT,
  decorators: SWITCH,
  deviation: TEXT,
  phase: TEXT,
  event: TEXT,
  group: TEXT,
  prefix: TEXT,
  role: TEXT,
  mapper: SWITCH,
  serializer: SWITCH,
  cache: TEXT,
  module: TEXT,
  'event-sourced': SWITCH,
  reason: TEXT,
  number: TEXT,
  name: TEXT,
  every: TEXT,
  cron: TEXT,
  'time-zone': TEXT,
  'dry-run': SWITCH,
  force: SWITCH,
  'local-only': SWITCH,
};

/** One flag may be a switch for a kind and a text for another: `--command` of a route, `--command <UseCase>` of a job. */
function optionsOf(kind: Kind | undefined): Record<string, typeof TEXT | typeof SWITCH | typeof TEXTS> {
  return { ...OPTIONS, ...Object.fromEntries((kind?.textFlags ?? []).map((flag) => [flag, TEXT])) };
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
      `Usage: ddd-ts-kit generate ${kind.usage}`,
    );
  }

  return kind;
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
  | 'mapper'
  | 'serializer'
  | 'eventSourced';

function switchesOf(args: Arguments): Pick<KindFlags, Switch> {
  return {
    command: args.flag('command'),
    query: args.flag('query'),
    allowName: args.flag('allow-name'),
    public: args.flag('public'),
    tenantScoped: args.flag('tenant-scoped'),
    search: args.flag('search'),
    decorators: args.flag('decorators'),
    mapper: args.flag('mapper'),
    serializer: args.flag('serializer'),
    eventSourced: args.flag('event-sourced'),
  };
}
