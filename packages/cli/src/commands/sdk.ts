import { CliError } from '../cli-error';
import { CONFIG_FILE, DEFAULT_SDK_NAME, editConfigText, parseConfig, readConfig, type Config } from '../config';
import { instructAgents, setUpSdk } from '../sdk';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import type { Io } from './io';
import { printReport } from './print-report';
import { stdoutJson } from '../json/stdout-json';

/**
 * Generates the typed client of each document of the contract under `clients/<document>`, and
 * what the project needs around them; asked the first time, it records "sdk" in the config.
 * With --check it writes nothing and fails while a client differs from its contract.
 */
export const sdkCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const { config } = readConfig(root);

  if (config.stack.http === 'none') {
    throw new CliError(
      'The project has no HTTP boundary, so no contract to generate a client from.',
      'Choose an HTTP framework (`ddd-ts-kit init --force --http express`) before asking for a client.',
    );
  }

  const ws = new Workspace(root, false);

  return args.flag('check') ? check(io, args, { ws, config }) : generate(io, args, { ws, config });
};

interface Run {
  readonly ws: Workspace;
  readonly config: Config;
}

function generate(io: Io, args: Arguments, { ws, config }: Run): number {
  const enabled = config.sdk === undefined ? enable(ws) : config;
  const { gone, unlocked } = setUpSdk(ws, enabled);

  for (const directory of gone) {
    ws.note(
      `${directory} is the client of a document the contract no longer has: delete it, and its package if it was published.`,
    );
  }

  if (unlocked.length > 0) {
    ws.note(unlockedNote(unlocked));
  }

  return printReport(io, args, ws.commit(args.flag('dry-run')));
}

/** Records "sdk" with its default name, and tells the agents: the clients are asked for from now on. */
function enable(ws: Workspace): Config {
  const text = editConfigText(ws.read(CONFIG_FILE) ?? '{}', (raw) => {
    raw['sdk'] = { name: DEFAULT_SDK_NAME };
  });

  ws.update(CONFIG_FILE, text);
  instructAgents(ws);

  return parseConfig(JSON.parse(text));
}

function check(io: Io, args: Arguments, { ws, config }: Run): number {
  if (config.sdk === undefined) {
    io.out(
      args.json ? stdoutJson({ ok: true, stale: [], unlocked: [] }) : `${CONFIG_FILE} asks for no client ("sdk").`,
    );

    return 0;
  }

  const { gone, unlocked } = setUpSdk(ws, config);
  const report = ws.commit(true);
  const stale = [...report.created, ...report.updated, ...gone];
  const ok = stale.length === 0 && unlocked.length === 0;

  if (args.json) {
    io.out(stdoutJson({ ok, stale, unlocked }));
  } else if (ok) {
    io.out('The clients are up to date with the contract.');
  } else {
    io.out(staleText(stale, unlocked));
  }

  return ok ? 0 : 1;
}

function staleText(stale: readonly string[], unlocked: readonly string[]): string {
  const parts: string[] = [];

  if (stale.length > 0) {
    parts.push(
      [...stale.map((file) => `stale  ${file}`), '', 'Run `ddd-ts-kit sdk` and commit the result.'].join('\n'),
    );
  }

  if (unlocked.length > 0) {
    parts.push(unlockedNote(unlocked));
  }

  return parts.join('\n\n');
}

/** npm writes the workspace packages in its lockfile: `npm ci` refuses a lock that misses one. */
function unlockedNote(unlocked: readonly string[]): string {
  return `package-lock.json does not list ${unlocked.join(', ')} yet: run \`npm install\` and commit package-lock.json, or \`npm ci\` refuses it in the pipeline.`;
}
