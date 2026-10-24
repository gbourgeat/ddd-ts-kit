import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../config/values/is-record';
import { MUTATION_REPORT } from './mutation-report-file';

/** One mutant of the report, as the json reporter of Stryker writes it: what changed, where, and what the tests did with it. */
interface ReportedMutant {
  readonly status: string;
  /** The mutator that made it, `ConditionalExpression`, `StringLiteral`, `EqualityOperator`. */
  readonly mutator: string;
  /** The first line of the code it replaced, 1-based. */
  readonly line: number;
  /** The code it put in place, as Stryker prints it; empty when the report does not say. */
  readonly replacement: string;
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

  return mutants.flatMap((mutant: unknown) => (isRecord(mutant) ? mutantOf(mutant) : []));
}

function mutantOf(mutant: Record<string, unknown>): ReportedMutant[] {
  const status = mutant['status'];

  if (typeof status !== 'string') {
    return [];
  }

  const location =
    isRecord(mutant['location']) && isRecord(mutant['location']['start']) ? mutant['location']['start'] : {};

  const line = location['line'];

  return [
    {
      status,
      mutator: typeof mutant['mutatorName'] === 'string' ? mutant['mutatorName'] : '',
      line: typeof line === 'number' ? line : 0,
      replacement: typeof mutant['replacement'] === 'string' ? mutant['replacement'] : '',
    },
  ];
}
