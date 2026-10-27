import { exitCodeOf, type WorkspaceReport } from '../workspace';
import type { Arguments } from './arguments';
import type { Io } from './io';

/** Prints what a command wrote (or would write), then where the next human decisions are; answers its exit code. */
export function printReport(io: Io, args: Arguments, report: WorkspaceReport): number {
  const dryRun = args.flag('dry-run');

  if (args.json) {
    io.out(JSON.stringify({ dryRun, ...report }, null, 2));

    return exitCodeOf(report);
  }

  const lines = fileLines(report, dryRun);

  if (report.todos.length > 0) {
    lines.push(
      '',
      'Next, in this order: the language of the context first, then the business decisions only you can make',
    );

    for (const todo of report.todos) {
      lines.push(`  ${todo.file}:${todo.line}  ${todo.text}`);
    }
  }

  if (report.notes.length > 0) {
    lines.push('', ...report.notes.map((note) => `note: ${note}`));
  }

  io.out(lines.join('\n'));

  return exitCodeOf(report);
}

function fileLines(report: WorkspaceReport, dryRun: boolean): string[] {
  const verb = (done: string): string => (dryRun ? `would ${done.replace(/d$/, '')}` : done).padEnd(13);

  const lines = [
    ...report.created.map((file) => `${verb('created')}${file}`),
    ...report.updated.map((file) => `${verb('updated')}${file}`),
    ...report.deleted.map((file) => `${verb('deleted')}${file}`),
    ...report.skipped.map((file) => `${'skipped'.padEnd(13)}${file} (${skippedBecause(report, file)})`),
  ];

  return lines.length > 0 ? lines : ['Nothing to do.'];
}

function skippedBecause(report: WorkspaceReport, file: string): string {
  return report.unwritable.includes(file)
    ? 'cannot be written here: a sandbox or the permissions protect the path'
    : 'exists; pass --force to replace it';
}
