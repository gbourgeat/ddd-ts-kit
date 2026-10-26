import type { WorkspaceReport } from './workspace-report';

/** A command left files unwritten where it ran (a sandbox protects them): neither violations (1) nor wrong usage (2). */
export const UNWRITTEN_EXIT_CODE = 3;

/** 0 once every file of the plan is written, or would be; 3 while one cannot be written here. */
export function exitCodeOf(report: Pick<WorkspaceReport, 'unwritable'>): number {
  return report.unwritable.length > 0 ? UNWRITTEN_EXIT_CODE : 0;
}
