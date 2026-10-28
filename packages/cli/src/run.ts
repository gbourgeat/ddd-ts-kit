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
import { helpFor } from './help/help-for';
import { usageFor } from './help/usage-for';
import { VERSION } from './version';
import { stdoutJson } from './json/stdout-json';

const COMMANDS: Readonly<Record<string, Command>> = {
  affected: affectedCommand,
  init: initCommand,
  generate: generateCommand,
  g: generateCommand,
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

    return refused(error, argv, io);
  }
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

function commandNamed(name: string): Command {
  const command = COMMANDS[name];

  if (command !== undefined) {
    return command;
  }

  throw new CliError(`Unknown command "${name}".`, `Use one of: ${Object.keys(COMMANDS).join(', ')}.`);
}
