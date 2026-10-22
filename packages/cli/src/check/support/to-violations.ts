import type { Finding } from '../model/finding';
import type { Report } from '../model/report';
import type { Violation } from '../model/violation';

export function toViolations(report: Report, file: string, findings: readonly Finding[]): Violation[] {
  return findings.map(({ line, message, fix }) => report({ file, line }, message, fix));
}
