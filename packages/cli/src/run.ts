import type { Command } from './commands/command.js';
import type { Io } from './commands/io.js';
import { acceptanceCommand } from './commands/acceptance.js';
import { affectedCommand } from './commands/affected.js';
import { buildAliasesCommand } from './commands/build-aliases.js';
import { checkFileCommand, explainCommand, rulesCommand } from './commands/check.js';
import { checksCommand } from './commands/checks.js';
import { citedCommand } from './commands/cited.js';
import { controllersCommand } from './commands/controllers.js';
import { depcruiseConfigCommand } from './commands/depcruise-config.js';
import { describeCommand } from './commands/describe.js';
import { docsCommand } from './commands/docs.js';
import { doctorCommand } from './commands/doctor.js';
import { lintCommand } from './commands/lint.js';
import { drizzleGenerateCommand } from './commands/drizzle-generate.js';
import { errorFactoriesCommand } from './commands/error-factories.js';
import { generateCommand } from './commands/generate.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { measuresCommand } from './commands/measures.js';
import { mergeTrunkCommand } from './commands/merge-trunk.js';
import { planWavesCommand } from './commands/plan-waves.js';
import { moveToModuleCommand } from './commands/move-to-module.js';
import { platformFoldersCommand } from './commands/platform-folders.js';
import { sdkCommand } from './commands/sdk.js';
import { statusCommand } from './commands/status.js';
import { storyCheckCommand } from './commands/story-check.js';
import { storiesCommand } from './commands/stories.js';
import { storyCommand } from './commands/story.js';
import { storyScopeCommand } from './commands/story-scope.js';
import { worktreeCommand } from './commands/worktree.js';
import { todoCommand } from './commands/todo.js';
import { valueObjectsCommand } from './commands/value-objects.js';
import { verifyMergeCommand } from './commands/verify-merge.js';
import { verifySliceCommand } from './commands/verify-slice.js';
import { workerScopeCommand } from './commands/worker-scope.js';
import { CliError } from './cli-error.js';
import { KINDS } from './generate/kinds.js';
import { kindsHelp } from './generate/kinds-help.js';
import { referenceText } from './help/reference-text.js';
import { VERSION } from './version.js';

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
  'error-factories': errorFactoriesCommand,
  'value-objects': valueObjectsCommand,
  'platform-folders': platformFoldersCommand,
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
  return `ddd-ts-kit ${VERSION}: bootstrap, scaffold and verify DDD and Clean Architecture TypeScript projects.

${referenceText()}`;
}
