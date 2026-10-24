import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../vitest/is-record';
import { REFERENCE_MUTATION } from './reference-mutation';

const CONFIG_FILE = 'ddd-ts-kit.config.json';

/** What the config file of a project says about mutation testing: where its contexts are and the floor of the domain layer. */
export interface MutationSettings {
  readonly contextsDir: string;
  /** The minimum mutation score of the domain layer of every context, a percentage. */
  readonly domain: number;
}

/**
 * Reads `ddd-ts-kit.config.json` at `root`. A floor the file does not give, or gives as something
 * that is not a percentage, is the reference: `ddd-ts-kit check` reports the second case.
 */
export function mutationSettings(root: string): MutationSettings {
  const config = readConfig(root);
  const sourceRoot = textOf(config['sourceRoot'], 'src');
  const written = isRecord(config['mutation']) ? config['mutation'] : {};

  return {
    contextsDir: textOf(config['contextsDir'], `${sourceRoot}/contexts`),
    domain: scoreOf(written['domain'], REFERENCE_MUTATION.domain),
  };
}

function readConfig(root: string): Record<string, unknown> {
  const file = path.join(root, CONFIG_FILE);

  if (!fs.existsSync(file)) {
    throw new Error(`${CONFIG_FILE} was not found in ${root}: the mutation floor of a project is read from it.`);
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));

  return isRecord(parsed) ? parsed : {};
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value.replaceAll('\\', '/') : fallback;
}

function scoreOf(value: unknown, reference: number): number {
  const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

  return valid ? value : reference;
}
