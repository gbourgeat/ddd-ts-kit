import type { Command } from './commands/command';
import type { Io } from './commands/io';
import { acceptanceCommand } from './commands/acceptance';
import { affectedCommand } from './commands/affected';
import { buildAliasesCommand } from './commands/build-aliases';
import { checkFileCommand, explainCommand, rulesCommand } from './commands/check';
import { checksCommand } from './commands/checks';
import { citedCommand } from './commands/cited';
import { controllersCommand } from './commands/controllers';
import { depcruiseConfigCommand } from './commands/depcruise-config';
import { describeCommand } from './commands/describe';
import { docsCommand } from './commands/docs';
import { doctorCommand } from './commands/doctor';
import { lintCommand } from './commands/lint';
import { drizzleGenerateCommand } from './commands/drizzle-generate';
import { prismaGenerateCommand } from './commands/prisma-generate';
import { typeormGenerateCommand } from './commands/typeorm-generate';
import { errorFactoriesCommand } from './commands/error-factories';
import { generateCommand } from './commands/generate';
import { initCommand } from './commands/init';
import { listCommand } from './commands/list';
import { measuresCommand } from './commands/measures';
import { mergeTrunkCommand } from './commands/merge-trunk';
import { planWavesCommand } from './commands/plan-waves';
import { moveToModuleCommand } from './commands/move-to-module';
import { contextLayoutCommand } from './commands/context-layout';
import { platformFoldersCommand } from './commands/platform-folders';
import { sdkCommand } from './commands/sdk';
import { statusCommand } from './commands/status';
import { storyCheckCommand } from './commands/story-check';
import { storiesCommand } from './commands/stories';
import { storyCommand } from './commands/story';
import { storyScopeCommand } from './commands/story-scope';
import { worktreeCommand } from './commands/worktree';
import { todoCommand } from './commands/todo';
import { mutationCommand } from './commands/mutation';
import { valueObjectsCommand } from './commands/value-objects';
import { verifyMergeCommand } from './commands/verify-merge';
import { verifySliceCommand } from './commands/verify-slice';
import { workerScopeCommand } from './commands/worker-scope';
import { CliError } from './cli-error';
import { ArgumentsError } from './commands/arguments-error';
import { ownEntry } from './config/values/own-entry';
import { helpFor } from './help/help-for';
import { usageFor } from './help/usage-for';
import { ISSUES_URL } from './issues-url';
import { VERSION } from './version';
import { stdoutJson } from './json/stdout-json';

const COMMANDS: Readonly<Record<string, Command>> = {
  affected: affectedCommand,
  init: initCommand,
  generate: generateCommand,
  list: listCommand,
  describe: describeCommand,
  status: statusCommand,
  todo: todoCommand,
  'plan-waves': planWavesCommand,
  'story-check': storyCheckCommand,
  acceptance: acceptanceCommand,
  'story-scope': storyScopeCommand,
  story: storyCommand,
  stories: storiesCommand,
  measures: measuresCommand,
  mutation: mutationCommand,
  worktree: worktreeCommand,
  'worker-scope': workerScopeCommand,
  'verify-slice': verifySliceCommand,
  cited: citedCommand,
  'verify-merge': verifyMergeCommand,
  'merge-trunk': mergeTrunkCommand,
  docs: docsCommand,
  doctor: doctorCommand,
  sdk: sdkCommand,
  'depcruise-config': depcruiseConfigCommand,
  'build-aliases': buildAliasesCommand,
  'drizzle-generate': drizzleGenerateCommand,
  'prisma-generate': prismaGenerateCommand,
  'typeorm-generate': typeormGenerateCommand,
  'error-factories': errorFactoriesCommand,
  'value-objects': valueObjectsCommand,
  'platform-folders': platformFoldersCommand,
  'context-layout': contextLayoutCommand,
  'move-to-module': moveToModuleCommand,
  controllers: controllersCommand,
  check: checksCommand,
  'check-file': checkFileCommand,
  lint: lintCommand,
  rules: rulesCommand,
  explain: explainCommand,
};

/** The exit code of a fault of the kit itself, apart from `1` (violations) and `2` (a mistake of the caller). */
const INTERNAL_ERROR = 4;

const processIo: Io = {
  out: (text) => void process.stdout.write(`${text}\n`),
  err: (text) => void process.stderr.write(`${text}\n`),
};

/** The other names of a command, resolved once: the help, the refusals and the command read the canonical one. */
const ALIASES: Readonly<Record<string, string>> = { g: 'generate' };

export function run(asked: readonly string[], io: Io = processIo): number {
  const argv = canonical(asked);
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
      return internalError(argv, error, io);
    }

    return refused(error, argv, io);
  }
}

/**
 * A fault of the kit, not of the caller: said in one line with the version and where to report
 * it, never with the exit code of a violation. Its stack trace, which tells where, follows the
 * line when `DDD_TS_KIT_DEBUG` is set, and is always in the JSON of `--json`.
 */
function internalError(argv: readonly string[], error: unknown, io: Io): number {
  const message = `internal error of ddd-ts-kit ${VERSION}: ${error instanceof Error ? error.message : String(error)}`;
  const fix = `Please report it at ${ISSUES_URL} with the command: ddd-ts-kit ${argv.join(' ')}`;
  const stack = error instanceof Error ? error.stack : undefined;

  if (argv.includes('--json')) {
    io.out(stdoutJson({ error: { message, fix, ...(stack === undefined ? {} : { stack }) }, internal: true }));
  } else {
    io.err(`${message}; ${fix.charAt(0).toLowerCase()}${fix.slice(1)}`);

    if (stack !== undefined && (process.env['DDD_TS_KIT_DEBUG'] ?? '') !== '') {
      io.err(stack);
    }
  }

  return INTERNAL_ERROR;
}

/** Prints a mistake of the caller with its fix; a refused argument is answered with the usage of its command or kind. */
function refused(error: CliError, argv: readonly string[], io: Io): number {
  const fix = (error instanceof ArgumentsError ? usageFor(argv) : undefined) ?? error.fix;

  if (argv.includes('--json')) {
    io.out(stdoutJson({ error: { message: error.message, fix } }));
  } else {
    io.err(`error: ${error.message}\n  fix: ${fix.split('\n').join('\n       ')}`);
  }

  return error.exitCode;
}

/** The command line with its command under its canonical name; `help <command> ...` read as `<command> ... --help`. */
function canonical(asked: readonly string[]): string[] {
  const [first, ...rest] = asked[0] === 'help' && asked.length > 1 ? [...asked.slice(1), '--help'] : asked;

  return first === undefined ? [] : [ownEntry(ALIASES, first) ?? first, ...rest];
}

function commandNamed(name: string): Command {
  const command = ownEntry(COMMANDS, name);

  if (command !== undefined) {
    return command;
  }

  const aliases = Object.entries(ALIASES).map(([alias, of]) => ` ${alias} is ${of}.`);

  throw new CliError(
    `Unknown command "${name}".`,
    `Use one of: ${Object.keys(COMMANDS).join(', ')}.${aliases.join('')}`,
  );
}
