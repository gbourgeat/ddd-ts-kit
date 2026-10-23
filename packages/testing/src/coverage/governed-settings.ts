import fs from 'node:fs';
import path from 'node:path';
import type { CoverageLayer } from './coverage-layer';
import type { CoverageRates } from './coverage-rates';
import { isRecord } from '../vitest/is-record';
import { REFERENCE_COVERAGE } from './reference-coverage';

const CONFIG_FILE = 'ddd-ts-kit.config.json';

/** What the config file of a project says about coverage: where its contexts are and the floor of each layer. */
export interface GovernedSettings {
  readonly contextsDir: string;
  readonly thresholds: Readonly<Record<CoverageLayer, CoverageRates>>;
}

/**
 * Reads `ddd-ts-kit.config.json` at `root`. A rate the file does not give, or gives as something
 * that is not a percentage, is the reference: `ddd-ts-kit check` reports the second case.
 */
export function governedSettings(root: string): GovernedSettings {
  const config = readConfig(root);
  const sourceRoot = textOf(config['sourceRoot'], 'src');
  const written = isRecord(config['coverage']) ? config['coverage'] : {};

  return {
    contextsDir: textOf(config['contextsDir'], `${sourceRoot}/contexts`),
    thresholds: {
      domain: ratesOf(written['domain'], REFERENCE_COVERAGE.domain),
      application: ratesOf(written['application'], REFERENCE_COVERAGE.application),
      presentation: ratesOf(written['presentation'], REFERENCE_COVERAGE.presentation),
      infrastructure: ratesOf(written['infrastructure'], REFERENCE_COVERAGE.infrastructure),
    },
  };
}

function readConfig(root: string): Record<string, unknown> {
  const file = path.join(root, CONFIG_FILE);

  if (!fs.existsSync(file)) {
    throw new Error(`${CONFIG_FILE} was not found in ${root}: the coverage thresholds of a project are read from it.`);
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));

  return isRecord(parsed) ? parsed : {};
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value.replaceAll('\\', '/') : fallback;
}

function ratesOf(value: unknown, reference: CoverageRates): CoverageRates {
  const written = isRecord(value) ? value : {};

  const rate = (metric: keyof CoverageRates): number => {
    const candidate = written[metric];
    const valid = typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= 100;

    return valid ? candidate : reference[metric];
  };

  return {
    statements: rate('statements'),
    branches: rate('branches'),
    functions: rate('functions'),
    lines: rate('lines'),
  };
}
