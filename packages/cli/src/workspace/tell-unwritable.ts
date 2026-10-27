import type { WorkspaceReport } from './workspace-report';

/**
 * For a command that prints its own report: the files it could not write where it ran, on the error
 * output, so that its JSON stays as it is. Nothing was deleted, so a move lost nothing.
 */
export function tellUnwritable(
  io: { readonly err: (text: string) => void },
  report: Pick<WorkspaceReport, 'unwritable'>,
): void {
  if (report.unwritable.length > 0) {
    io.err(
      `error: ${report.unwritable.length} file(s) could not be written here, where a sandbox or the permissions protect them: ${report.unwritable.join(', ')}. Nothing was deleted. Run the same command where they can be written.`,
    );
  }
}
