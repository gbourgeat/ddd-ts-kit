import type { Command, Io } from './commands/args.js';
import { checkCommand, checkFileCommand, explainCommand, rulesCommand } from './commands/check.js';
import { depcruiseConfigCommand } from './commands/depcruise-config.js';
import { docsCommand } from './commands/docs.js';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { CliError } from './errors.js';
import { KINDS } from './generate/kinds.js';

export type { Io } from './commands/args.js';

export const VERSION = '0.1.0';

const COMMANDS: Readonly<Record<string, Command>> = {
  init: initCommand,
  generate: generateCommand,
  g: generateCommand,
  list: listCommand,
  docs: docsCommand,
  'depcruise-config': depcruiseConfigCommand,
  check: checkCommand,
  'check-file': checkFileCommand,
  rules: rulesCommand,
  explain: explainCommand,
};

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
    if (command === undefined || command === 'help' || [command, ...rest].some((argument) => argument === '--help' || argument === '-h')) {
      io.out(help());
      return 0;
    }
    return commandNamed(command)(rest, io);
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    if (argv.includes('--json')) io.out(JSON.stringify({ error: { message: error.message, fix: error.fix } }, null, 2));
    else io.err(`error: ${error.message}\n  fix: ${error.fix}`);
    return error.exitCode;
  }
}

function commandNamed(name: string): Command {
  const command = COMMANDS[name];
  if (command !== undefined) return command;
  throw new CliError(`Unknown command "${name}".`, `Use one of: ${Object.keys(COMMANDS).join(', ')}.`);
}

function help(): string {
  const kinds = KINDS.map((kind) => `  ${kind.usage}${kind.aliases.length > 0 ? `   (alias: ${kind.aliases.join(', ')})` : ''}`);
  return `ddd-ts-kit ${VERSION}: bootstrap, scaffold and verify DDD and Clean Architecture TypeScript projects.

Usage
  ddd-ts-kit init [--http express|fastify|nest|none] [--validation zod|class-validator|standard-schema|none]
                  [--di tsyringe|nest|manual] [--tests vitest|jest]
                  [--orm drizzle|knex|prisma|typeorm|custom|none] [--database postgres|mysql|sqlite|none]
                  [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                  [--ci github|gitlab|both|none] [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                  [--broker none|rabbitmq|custom] [--cache none|redis] [--audit on|off]
                  [--allow-no-outbox "<reason>"]
                  [--context <name>:<core|supporting|generic>]... [--dry-run] [--force]
  ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--dry-run] [--force]     (alias: g)
  ddd-ts-kit list
  ddd-ts-kit docs [--check]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab] [--changed-since <git-ref>] [--self]
  ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
  ddd-ts-kit check-file <path>
  ddd-ts-kit rules
  ddd-ts-kit explain <rule-id>

Every command accepts --json (machine-readable output) and --cwd <dir> (project root).

Kinds
${kinds.join('\n')}`;
}
