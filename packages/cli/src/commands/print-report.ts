import type { WorkspaceReport } from '../workspace/index.js';
import type { Arguments } from './arguments.js';
import type { Io } from './io.js';

/** Prints what a command wrote (or would write), then where the next human decisions are. */
export function printReport(io: Io, args: Arguments, report: WorkspaceReport): void {
  const dryRun = args.flag('dry-run');

  if (args.json) {
    io.out(JSON.stringify({ dryRun, ...report }, null, 2));

    return;
  }

  const lines = fileLines(report, dryRun);

  if (report.todos.length > 0) {
    lines.push('', 'Next, in this order: the language of the context first, then the business decisions only you can make');

    for (const todo of report.todos) lines.push(`  ${todo.file}:${todo.line}  ${todo.text}`);
  }

  if (report.notes.length > 0) lines.push('', ...report.notes.map((note) => `note: ${note}`));

  io.out(lines.join('\n'));
}

function fileLines(report: WorkspaceReport, dryRun: boolean): string[] {
  const verb = (done: string): string => (dryRun ? `would ${done.replace(/d$/, '')}` : done).padEnd(13);

  const lines = [
    ...report.created.map((file) => `${verb('created')}${file}`),
    ...report.updated.map((file) => `${verb('updated')}${file}`),
    ...report.skipped.map((file) => `${'skipped'.padEnd(13)}${file} (exists; pass --force to replace it)`),
  ];

  return lines.length > 0 ? lines : ['Nothing to do.'];
}
