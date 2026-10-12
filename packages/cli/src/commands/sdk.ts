import { CliError } from '../cli-error.js';
import {
  CONFIG_FILE,
  DEFAULT_SDK_NAME,
  editConfigText,
  parseConfig,
  readConfig,
  type Config,
} from '../config/index.js';
import { setUpSdk } from '../sdk/index.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import type { Io } from './io.js';
import { printReport } from './print-report.js';

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
  const gone = setUpSdk(ws, enabled);

  for (const directory of gone) {
    ws.note(
      `${directory} is the client of a document the contract no longer has: delete it, and its package if it was published.`,
    );
  }

  printReport(io, args, ws.commit(args.flag('dry-run')));

  return 0;
}

/** Records "sdk" with its default name: the clients are asked for from now on. */
function enable(ws: Workspace): Config {
  const text = editConfigText(ws.read(CONFIG_FILE) ?? '{}', (raw) => {
    raw['sdk'] = { name: DEFAULT_SDK_NAME };
  });

  ws.update(CONFIG_FILE, text);

  return parseConfig(JSON.parse(text));
}

function check(io: Io, args: Arguments, { ws, config }: Run): number {
  if (config.sdk === undefined) {
    io.out(args.json ? JSON.stringify({ ok: true, stale: [] }, null, 2) : `${CONFIG_FILE} asks for no client ("sdk").`);

    return 0;
  }

  const gone = setUpSdk(ws, config);
  const report = ws.commit(true);
  const stale = [...report.created, ...report.updated, ...gone];

  if (args.json) {
    io.out(JSON.stringify({ ok: stale.length === 0, stale }, null, 2));
  } else if (stale.length === 0) {
    io.out('The clients are up to date with the contract.');
  } else {
    io.out([...stale.map((file) => `stale  ${file}`), '', 'Run `ddd-ts-kit sdk` and commit the result.'].join('\n'));
  }

  return stale.length === 0 ? 0 : 1;
}
