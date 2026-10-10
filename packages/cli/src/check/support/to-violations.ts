import type { Finding } from '../model/finding.js';
import type { Report } from '../model/report.js';
import type { Violation } from '../model/violation.js';

export function toViolations(report: Report, file: string, findings: readonly Finding[]): Violation[] {
  return findings.map(({ line, message, fix }) => report({ file, line }, message, fix));
}
