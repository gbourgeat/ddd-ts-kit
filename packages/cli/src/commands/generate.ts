import { CONFIG_FILE, parseConfig, readConfig } from '../config.js';
import { DEPCRUISE_FILE, renderCruiseFile } from '../depcruise/configuration.js';
import { CONTEXT_MAP, writeDocs } from '../docs/docs.js';
import { CliError } from '../errors.js';
import type { Kind, KindFlags } from '../generate/kind.js';
import { refreshBarrels } from '../generate/declared.js';
import { findKind, KINDS } from '../generate/kinds.js';
import { Workspace } from '../workspace.js';
import { Arguments, type Command } from './args.js';
import { printReport } from './report.js';

export const generateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, OPTIONS);
  const [kindName, ...rest] = args.positionals;
  const kind = requestedKind(kindName, rest);
  const root = args.projectRoot;
  const ws = new Workspace(root, args.flag('force'));
  kind.run({ ws, config: readConfig(root).config, args: rest, flags: flagsOf(args) });
  refreshDocs(ws);
  printReport(io, args, ws.commit(args.flag('dry-run')));
  return 0;
};

/** Every flag a kind may take; each kind reads the ones it knows. */
const OPTIONS = {
  classification: { type: 'string' },
  purpose: { type: 'string' },
  upstream: { type: 'string', multiple: true },
  term: { type: 'string', multiple: true },
  code: { type: 'string' },
  aggregate: { type: 'string' },
  method: { type: 'string' },
  path: { type: 'string' },
  command: { type: 'boolean', default: false },
  query: { type: 'boolean', default: false },
  version: { type: 'string' },
  'allow-name': { type: 'boolean', default: false },
  permission: { type: 'string' },
  public: { type: 'boolean', default: false },
  'tenant-scoped': { type: 'boolean', default: false },
  list: { type: 'boolean', default: false },
  kind: { type: 'string' },
  decorators: { type: 'boolean', default: false },
  deviation: { type: 'string' },
  reason: { type: 'string' },
  'dry-run': { type: 'boolean', default: false },
  force: { type: 'boolean', default: false },
} as const;

/** Keeps what is derived from the config and the tree in step with what was just scaffolded, once the project has it. */
function refreshDocs(ws: Workspace): void {
  const config = ws.read(CONFIG_FILE);
  if (config === undefined) return;
  const current = parseConfig(JSON.parse(config));
  refreshBarrels(ws, current);
  if (ws.exists(CONTEXT_MAP)) writeDocs(ws, current);
  // The import graph rules are derived from the config: a new context or upstream changes them.
  if (ws.exists(DEPCRUISE_FILE)) ws.update(DEPCRUISE_FILE, renderCruiseFile(current));
}

function requestedKind(name: string | undefined, rest: readonly string[]): Kind {
  const kind = name === undefined ? undefined : findKind(name);
  if (kind === undefined) {
    throw new CliError(name === undefined ? 'generate needs a kind.' : `Unknown kind "${name}".`, `Use one of: ${KINDS.map((candidate) => candidate.name).join(', ')}.`);
  }
  if (rest.length !== kind.positionals.length) {
    throw new CliError(`${kind.name} expects ${kind.positionals.length} argument(s): ${kind.positionals.join(', ')}.`, `Usage: ddd-ts-kit generate ${kind.usage}`);
  }
  return kind;
}

function flagsOf(args: Arguments): KindFlags {
  return {
    ...args.texts(['classification', 'purpose', 'code', 'aggregate', 'method', 'path', 'version', 'permission', 'deviation', 'reason', 'kind']),
    upstream: args.many('upstream'),
    term: args.many('term'),
    command: args.flag('command'),
    query: args.flag('query'),
    allowName: args.flag('allow-name'),
    public: args.flag('public'),
    tenantScoped: args.flag('tenant-scoped'),
    list: args.flag('list'),
    decorators: args.flag('decorators'),
  };
}
