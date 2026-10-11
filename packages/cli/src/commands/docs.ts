import { readConfig } from '../config/index.js';
import { writeDocs } from '../docs/write-docs.js';
import { stopIgnoringValidation } from '../generate/stop-ignoring-validation.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import { printReport } from './print-report.js';

export const docsCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const ws = new Workspace(root, false);

  writeDocs(ws, readConfig(root).config);

  if (!args.flag('check')) {
    stopIgnoringValidation(ws, readConfig(root).config);
    printReport(io, args, ws.commit(args.flag('dry-run')));

    return 0;
  }

  const report = ws.commit(true);
  const stale = [...report.created, ...report.updated];

  if (args.json) {
    io.out(JSON.stringify({ ok: stale.length === 0, stale }, null, 2));
  } else if (stale.length === 0) {
    io.out('The generated documentation is up to date.');
  } else {
    io.out([...stale.map((file) => `stale  ${file}`), '', 'Run `ddd-ts-kit docs` and commit the result.'].join('\n'));
  }

  return stale.length === 0 ? 0 : 1;
};
