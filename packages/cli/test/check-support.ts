import { read, write, type CliResult } from './helpers';

export const AGGREGATE = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
export const HANDLER = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';
export const CONFIG = 'ddd-ts-kit.config.json';

interface ReportedViolation {
  readonly ruleId: string;
  readonly severity: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly fix: string;
}

/** What `ddd-ts-kit check --json` prints. */
export interface CheckJson {
  readonly ok: boolean;
  readonly errors: number;
  readonly warnings: number;
  readonly suppressions: number;
  readonly suppressed: number;
  readonly files: number;
  readonly violations: readonly ReportedViolation[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The report a `check --json` or `check-file --json` run printed. */
export function checkJsonOf(result: CliResult): CheckJson {
  const parsed = result.json();

  if (!isCheckJson(parsed)) {
    throw new Error(`Not a check report: ${result.stdout}`);
  }

  return parsed;
}

function isCheckJson(value: unknown): value is CheckJson {
  return isRecord(value) && typeof value['errors'] === 'number' && Array.isArray(value['violations']);
}

/** The `fix` of the error a refused command printed with `--json`. */
export function errorFixOf(result: CliResult): string {
  const parsed = result.json();
  const error = isRecord(parsed) ? parsed['error'] : undefined;
  const fix = isRecord(error) ? error['fix'] : undefined;

  return typeof fix === 'string' ? fix : '';
}

/** Rewrites the config of a project with the keys given over what it holds. */
export function changeConfig(root: string, changes: Record<string, unknown>): void {
  const parsed: unknown = JSON.parse(read(root, CONFIG));

  write(root, CONFIG, JSON.stringify({ ...(isRecord(parsed) ? parsed : {}), ...changes }, null, 2));
}
