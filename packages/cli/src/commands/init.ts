import fs from 'node:fs';
import { CliError } from '../cli-error';
import { runInit, type InitOptions } from '../init/run-init';
import { Arguments } from './arguments';
import { type Command } from './command';
import { printReport } from './print-report';
import { VERSION } from '../version';

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
  'rpc',
  'storage',
  'audit',
  'privacy',
  'errors',
  'logger',
  'style',
  'assembly',
  'dependencies',
  'refusals',
  'routes',
  'representations',
  'forms',
  'schemas',
  'literals',
  'values',
  'tenancy',
  'queue',
] as const;

const OTHER_TEXT_FLAGS = [
  'docs-ui',
  'http-cache',
  'event-sourcing',
  'ci-extras',
  'allow-no-outbox',
  'import-alias',
  'import-extension',
  'package-manager',
  'value-objects',
  'agent-profile',
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

  printReport(io, args, runInit(root, { ...initOptions(args, dryRun), rerun: rerunOf(argv) }));

  return 0;
};

/** The command the owner runs outside a sandbox to write what this one could not: the same flags, written for real. */
function rerunOf(argv: readonly string[]): string {
  const flags = argv.filter((arg) => arg !== '--json' && arg !== '--dry-run').map(quoted);

  return ['npx', `ddd-ts-kit@${VERSION}`, 'init', ...flags].join(' ');
}

function quoted(arg: string): string {
  return /^[\w./:=@,+-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

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
  const httpCache = args.text('http-cache');
  const eventSourcing = args.text('event-sourcing');
  const ciExtras = args.text('ci-extras');
  const allowNoOutbox = args.text('allow-no-outbox');
  const importAlias = args.text('import-alias');
  const importExtension = args.text('import-extension');
  const packageManager = args.text('package-manager');
  const valueObjects = args.text('value-objects');

  return {
    ...args.texts(STACK_FLAGS),
    ...(docsUi === undefined ? {} : { docsUi }),
    ...(httpCache === undefined ? {} : { httpCache }),
    ...(eventSourcing === undefined ? {} : { eventSourcing }),
    ...(ciExtras === undefined ? {} : { ciExtras }),
    ...(allowNoOutbox === undefined ? {} : { allowNoOutbox }),
    ...(importAlias === undefined ? {} : { importAlias }),
    ...(importExtension === undefined ? {} : { importExtension }),
    ...(packageManager === undefined ? {} : { packageManager }),
    ...(valueObjects === undefined ? {} : { valueObjects }),
    ...agentOptions(args),
  };
}

/** What `init` records about the agents of the project: the typed clients they get, the profile that holds them. */
function agentOptions(args: Arguments): Pick<InitOptions, 'sdk' | 'agentProfile'> {
  const agentProfile = args.text('agent-profile');

  return {
    ...(args.flag('sdk') ? { sdk: true } : {}),
    ...(agentProfile === undefined ? {} : { agentProfile }),
  };
}
