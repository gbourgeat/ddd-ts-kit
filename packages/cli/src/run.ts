import type { Command } from './commands/command.js';
import type { Io } from './commands/io.js';
import { checkFileCommand, explainCommand, rulesCommand } from './commands/check.js';
import { checksCommand } from './commands/checks.js';
import { depcruiseConfigCommand } from './commands/depcruise-config.js';
import { describeCommand } from './commands/describe.js';
import { docsCommand } from './commands/docs.js';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { statusCommand } from './commands/status.js';
import { todoCommand } from './commands/todo.js';
import { workerScopeCommand } from './commands/worker-scope.js';
import { CliError } from './cli-error.js';
import { KINDS } from './generate/kinds.js';
import { kindsHelp } from './generate/kinds-help.js';
import { VERSION } from './version.js';

const COMMANDS: Readonly<Record<string, Command>> = {
  init: initCommand,
  generate: generateCommand,
  g: generateCommand,
  list: listCommand,
  describe: describeCommand,
  status: statusCommand,
  todo: todoCommand,
  'worker-scope': workerScopeCommand,
  docs: docsCommand,
  'depcruise-config': depcruiseConfigCommand,
  check: checksCommand,
  'check-file': checkFileCommand,
  rules: rulesCommand,
  explain: explainCommand,
};

const USAGE = `Usage
  ddd-ts-kit init [--http express|fastify|nest|none] [--validation zod|class-validator|standard-schema|none]
                  [--di tsyringe|nest|manual] [--tests vitest|jest]
                  [--orm drizzle|knex|prisma|typeorm|custom|none] [--database postgres|mysql|sqlite|none]
                  [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                  [--ci github|gitlab|both|none] [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                  [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis] [--audit on|off]
                  [--errors none|sentry] [--logger stdout|pino|winston] [--style declared|explicit] [--assembly barrel|discovery]
                  [--allow-no-outbox "<reason>"]
                  [--context <name>:<core|supporting|generic>]... [--dry-run] [--force]
  ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--local-only] [--dry-run] [--force]     (alias: g)
  ddd-ts-kit generate --help --json
  ddd-ts-kit list [--context <name>]
  ddd-ts-kit describe <context>
  ddd-ts-kit status
  ddd-ts-kit todo [<context>]
  ddd-ts-kit worker-scope <context> [--worktree <path>] [--branch <name>] [--dry-run]
  ddd-ts-kit docs [--check]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab] [--changed-since <git-ref>] [--self]
  ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
  ddd-ts-kit check --commit-size [--staged] [--strict]
  ddd-ts-kit check-file <path>
  ddd-ts-kit rules
  ddd-ts-kit explain <rule-id>

Every command accepts --json (machine-readable output) and --cwd <dir> (project root).`;

const NOTES = `  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, and the TODO(domain), TODO(platform) and it.todo left in each context
  todo             those markers as file:line, in the project or in one context
  worker-scope     a git worktree on the branch build/<context> (by default ../<project>-<context>), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do`;

const processIo: Io = {
  out: (text) => void process.stdout.write(`${text}\n`),
  err: (text) => void process.stderr.write(`${text}\n`),
};

export function run(argv: readonly string[], io: Io = processIo): number {
  const [command, ...rest] = argv;

  try {
    if (command === '--version' || command === '-v') {
      io.out(VERSION);

      return 0;
    }

    if (
      command === undefined ||
      command === 'help' ||
      [command, ...rest].some((argument) => argument === '--help' || argument === '-h')
    ) {
      io.out(helpFor(argv));

      return 0;
    }

    return commandNamed(command)(rest, io);
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }

    if (argv.includes('--json')) {
      io.out(JSON.stringify({ error: { message: error.message, fix: error.fix } }, null, 2));
    } else {
      io.err(`error: ${error.message}\n  fix: ${error.fix}`);
    }

    return error.exitCode;
  }
}

function commandNamed(name: string): Command {
  const command = COMMANDS[name];

  if (command !== undefined) {
    return command;
  }

  throw new CliError(`Unknown command "${name}".`, `Use one of: ${Object.keys(COMMANDS).join(', ')}.`);
}

/** `generate --help --json` answers the kinds as data, with whether each one writes outside its context. */
function helpFor(argv: readonly string[]): string {
  const kinds = (argv[0] === 'generate' || argv[0] === 'g') && argv.includes('--json');

  return kinds ? JSON.stringify({ kinds: kindsHelp(KINDS) }, null, 2) : help();
}

function help(): string {
  const kinds = KINDS.map(
    (kind) => `  ${kind.usage}${kind.aliases.length > 0 ? `   (alias: ${kind.aliases.join(', ')})` : ''}`,
  );

  return `ddd-ts-kit ${VERSION}: bootstrap, scaffold and verify DDD and Clean Architecture TypeScript projects.

${USAGE}

${NOTES}

Kinds
${kinds.join('\n')}`;
}
