import { CONFIG_FILE, parseConfig, readConfig } from '../config/index.js';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file.js';
import { renderCruiseFile } from '../depcruise/render-cruise-file.js';
import { CONTEXT_MAP } from '../docs/context-map-file.js';
import { writeDocs } from '../docs/write-docs.js';
import { CliError } from '../cli-error.js';
import { findKind } from '../generate/find-kind.js';
import type { Kind, KindFlags } from '../generate/kind.js';
import { KINDS } from '../generate/kinds.js';
import { refreshBarrels } from '../generate/refresh-barrels.js';
import { refuseSharedWrites } from '../generate/refuse-shared-writes.js';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation.js';
import { toName } from '../naming/index.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import { printReport } from './print-report.js';

export const generateCommand: Command = (argv, io) => {
  const asked = findKind(argv.find((argument) => !argument.startsWith('-')) ?? '');
  const args = Arguments.parse(argv, optionsOf(asked));
  const [kindName, ...rest] = args.positionals;
  const kind = requestedKind(kindName, rest);
  const root = args.projectRoot;
  const ws = new Workspace(root, args.flag('force'));
  const { config } = readConfig(root);

  kind.run({ ws, config, args: rest, flags: flagsOf(args) });
  refreshDocs(ws);

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
  group: TEXT,
  prefix: TEXT,
  role: TEXT,
  mapper: SWITCH,
  serializer: SWITCH,
  cache: TEXT,
  'event-sourced': SWITCH,
  reason: TEXT,
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

/** Keeps what is derived from the config and the tree in step with what was just scaffolded, once the project has it. */
function refreshDocs(ws: Workspace): void {
  const config = ws.read(CONFIG_FILE);

  if (config === undefined) {
    return;
  }

  const current = parseConfig(JSON.parse(config));

  refreshBarrels(ws, current);

  if (ws.exists(CONTEXT_MAP)) {
    writeDocs(ws, current);
  }

  // The import graph rules are derived from the config: a new context or upstream changes them.
  if (ws.exists(DEPCRUISE_FILE)) {
    ws.update(DEPCRUISE_FILE, renderCruiseFile(current));
  }
}

function requestedKind(name: string | undefined, rest: readonly string[]): Kind {
  const kind = name === undefined ? undefined : findKind(name);

  if (kind === undefined) {
    throw new CliError(
      name === undefined ? 'generate needs a kind.' : `Unknown kind "${name}".`,
      `Use one of: ${KINDS.map((candidate) => candidate.name).join(', ')}.`,
    );
  }

  if (rest.length !== kind.positionals.length) {
    throw new CliError(
      `${kind.name} expects ${kind.positionals.length} argument(s): ${kind.positionals.join(', ')}.`,
      `Usage: ddd-ts-kit generate ${kind.usage}`,
    );
  }

  return kind;
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
  'kind',
  'every',
  'cron',
  'phase',
  'group',
  'prefix',
  'role',
  'cache',
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
