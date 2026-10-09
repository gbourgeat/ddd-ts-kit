import { readConfig } from '../config.js';
import { writeDocs } from '../docs/docs.js';
import { Workspace } from '../workspace.js';
import { Arguments, type Command } from './args.js';
import { printReport } from './report.js';

export const docsCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { check: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false } });
  const root = args.projectRoot;
  const ws = new Workspace(root, false);
  writeDocs(ws, readConfig(root).config);
  if (!args.flag('check')) {
    printReport(io, args, ws.commit(args.flag('dry-run')));
    return 0;
  }
  const report = ws.commit(true);
  const stale = [...report.created, ...report.updated];
  if (args.json) io.out(JSON.stringify({ ok: stale.length === 0, stale }, null, 2));
  else if (stale.length === 0) io.out('The generated documentation is up to date.');
  else io.out([...stale.map((file) => `stale  ${file}`), '', 'Run `ddd-ts-kit docs` and commit the result.'].join('\n'));
  return stale.length === 0 ? 0 : 1;
};
