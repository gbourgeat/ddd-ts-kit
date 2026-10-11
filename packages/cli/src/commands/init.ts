import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { runInit } from '../init/run-init.js';
import { Arguments } from './arguments.js';
import { type Command } from './command.js';
import { printReport } from './print-report.js';

const STACK_FLAGS = [
  'http',
  'validation',
  'di',
  'tests',
  'orm',
  'database',
  'events',
  'ci',
  'authn',
  'authz',
  'broker',
  'cache',
  'audit',
  'errors',
  'logger',
  'style',
  'assembly',
] as const;

export const initCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    ...Object.fromEntries(
      [...STACK_FLAGS, 'docs-ui', 'allow-no-outbox', 'import-alias', 'package-manager'].map((flag) => [
        flag,
        { type: 'string' as const },
      ]),
    ),
    context: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  });

  if (args.positionals.length > 0) {
    throw new CliError(
      `Unexpected argument "${args.positionals[0] ?? ''}".`,
      'Pass the target directory with --cwd <dir>.',
    );
  }

  const root = args.workingDirectory;
  const dryRun = args.flag('dry-run');

  if (!dryRun) {
    fs.mkdirSync(root, { recursive: true });
  }

  printReport(
    io,
    args,
    runInit(root, { ...stackOptions(args), contexts: args.many('context'), dryRun, force: args.flag('force') }),
  );

  return 0;
};

function stackOptions(args: Arguments) {
  const docsUi = args.text('docs-ui');
  const allowNoOutbox = args.text('allow-no-outbox');
  const importAlias = args.text('import-alias');
  const packageManager = args.text('package-manager');

  return {
    ...args.texts(STACK_FLAGS),
    ...(docsUi === undefined ? {} : { docsUi }),
    ...(allowNoOutbox === undefined ? {} : { allowNoOutbox }),
    ...(importAlias === undefined ? {} : { importAlias }),
    ...(packageManager === undefined ? {} : { packageManager }),
  };
}
