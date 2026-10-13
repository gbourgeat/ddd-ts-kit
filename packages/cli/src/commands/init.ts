import fs from 'node:fs';
import { CliError } from '../cli-error.js';
import { runInit, type InitOptions } from '../init/run-init.js';
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
  'storage',
  'audit',
  'errors',
  'logger',
  'style',
  'assembly',
  'dependencies',
  'refusals',
  'routes',
  'tenancy',
  'literals',
  'tenancy',
] as const;

const OTHER_TEXT_FLAGS = [
  'docs-ui',
  'ci-extras',
  'allow-no-outbox',
  'import-alias',
  'import-extension',
  'package-manager',
  'value-objects',
];

export const initCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    ...Object.fromEntries([...STACK_FLAGS, ...OTHER_TEXT_FLAGS].map((flag) => [flag, { type: 'string' as const }])),
    context: { type: 'string', multiple: true },
    preset: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    sdk: { type: 'boolean', default: false },
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

  printReport(io, args, runInit(root, initOptions(args, dryRun)));

  return 0;
};

function initOptions(args: Arguments, dryRun: boolean): InitOptions {
  return {
    ...stackOptions(args),
    contexts: args.many('context'),
    presets: args.many('preset'),
    dryRun,
    force: args.flag('force'),
  };
}

function stackOptions(args: Arguments) {
  const docsUi = args.text('docs-ui');
  const ciExtras = args.text('ci-extras');
  const allowNoOutbox = args.text('allow-no-outbox');
  const importAlias = args.text('import-alias');
  const importExtension = args.text('import-extension');
  const packageManager = args.text('package-manager');
  const valueObjects = args.text('value-objects');

  return {
    ...args.texts(STACK_FLAGS),
    ...(docsUi === undefined ? {} : { docsUi }),
    ...(ciExtras === undefined ? {} : { ciExtras }),
    ...(allowNoOutbox === undefined ? {} : { allowNoOutbox }),
    ...(importAlias === undefined ? {} : { importAlias }),
    ...(importExtension === undefined ? {} : { importExtension }),
    ...(packageManager === undefined ? {} : { packageManager }),
    ...(valueObjects === undefined ? {} : { valueObjects }),
    ...(args.flag('sdk') ? { sdk: true } : {}),
  };
}
