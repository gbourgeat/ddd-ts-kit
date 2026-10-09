import fs from 'node:fs';
import { CliError } from '../errors.js';
import { runInit } from '../init/init.js';
import { Arguments, type Command } from './args.js';
import { printReport } from './report.js';

export const initCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    http: { type: 'string' },
    validation: { type: 'string' },
    di: { type: 'string' },
    tests: { type: 'string' },
    orm: { type: 'string' },
    database: { type: 'string' },
    events: { type: 'string' },
    'docs-ui': { type: 'string' },
    ci: { type: 'string' },
    context: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  });
  if (args.positionals.length > 0) {
    throw new CliError(`Unexpected argument "${args.positionals[0] ?? ''}".`, 'Pass the target directory with --cwd <dir>.');
  }
  const root = args.workingDirectory;
  const dryRun = args.flag('dry-run');
  if (!dryRun) fs.mkdirSync(root, { recursive: true });
  const docsUi = args.text('docs-ui');
  const report = runInit(root, {
    ...args.texts(['http', 'validation', 'di', 'tests', 'orm', 'database', 'events', 'ci']),
    ...(docsUi === undefined ? {} : { docsUi }),
    contexts: args.many('context'),
    dryRun,
    force: args.flag('force'),
  });
  printReport(io, args, report);
  return 0;
};
