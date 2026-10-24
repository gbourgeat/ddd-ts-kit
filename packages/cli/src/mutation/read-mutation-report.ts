import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../config/values/is-record';
import { MUTATION_REPORT } from './mutation-report-file';

/** One mutant of the report, as the json reporter of Stryker writes it. */
export interface ReportedMutant {
  readonly status: string;
}

/** The report of a Stryker run: the mutants of each file, keyed by the path of the file from the project root. */
export type MutationReport = Readonly<Record<string, readonly ReportedMutant[]>>;

/** Reads the json report a run wrote, or nothing when no run did. */
export function readMutationReport(root: string, file = MUTATION_REPORT): MutationReport | undefined {
  const at = path.join(root, file);

  if (!fs.existsSync(at)) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(at, 'utf8'));
  const files = isRecord(parsed) && isRecord(parsed['files']) ? parsed['files'] : {};

  return Object.fromEntries(
    Object.entries(files).map(([reported, content]) => [reported.replaceAll('\\', '/'), mutantsOf(content)]),
  );
}

function mutantsOf(content: unknown): ReportedMutant[] {
  const mutants: unknown = isRecord(content) ? content['mutants'] : undefined;

  if (!Array.isArray(mutants)) {
    return [];
  }

  return mutants.flatMap((mutant: unknown) =>
    isRecord(mutant) && typeof mutant['status'] === 'string' ? [{ status: mutant['status'] }] : [],
  );
}
