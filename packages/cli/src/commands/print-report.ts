import { exitCodeOf, type WorkspaceReport } from '../workspace';
import type { Arguments } from './arguments';
import type { Io } from './io';
import { stdoutJson } from '../json/stdout-json';

/** Prints what a command wrote (or would write), then where the next human decisions are, one line each; answers its exit code. */
export function printReport(io: Io, args: Arguments, report: WorkspaceReport): number {
  const dryRun = args.flag('dry-run');

  if (args.json) {
    io.out(stdoutJson({ dryRun, ...report }));

    return exitCodeOf(report);
  }

  const lines = fileLines(report, dryRun);

  if (report.todos.length > 0) {
    lines.push(
      '',
      'Next, in this order: the language of the context first, then the business decisions only you can make',
    );

    // A marker by its first words, the file holding its sentence; a step whole, no file holding it.
    for (const todo of report.todos) {
      lines.push(`  ${todo.file}:${todo.line}  ${todo.text ?? todo.gist}`);
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
