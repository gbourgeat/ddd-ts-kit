import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../vitest/is-record';
import { type BudgetLevel, REFERENCE_BUDGET } from './reference-budget';

const CONFIG_FILE = 'ddd-ts-kit.config.json';

/** What the config file of a project says about the time its specs may take: a budget per level, in milliseconds. */
export interface BudgetSettings {
  readonly budget: Readonly<Record<BudgetLevel, number>>;
}

/**
 * Reads `ddd-ts-kit.config.json` at `root`. A budget the file does not give, or gives as something
 * that is not a duration, is the reference: `ddd-ts-kit check` reports the second case.
 */
export function budgetSettings(root: string): BudgetSettings {
  const config = readConfig(root);
  const written = isRecord(config['budget']) ? config['budget'] : {};

  return {
    budget: {
      unit: durationOf(written['unit'], REFERENCE_BUDGET.unit),
      integration: durationOf(written['integration'], REFERENCE_BUDGET.integration),
    },
  };
}

function readConfig(root: string): Record<string, unknown> {
  const file = path.join(root, CONFIG_FILE);

  if (!fs.existsSync(file)) {
    throw new Error(
      `${CONFIG_FILE} was not found in ${root}: the time budget of the specs of a project is read from it.`,
    );
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));

  return isRecord(parsed) ? parsed : {};
}

function durationOf(value: unknown, reference: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : reference;
}
