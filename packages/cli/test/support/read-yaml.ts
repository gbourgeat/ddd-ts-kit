import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from '../helpers';

/** What a YAML text reads as, for each parser: YAML 1.2 and 1.1 by `yaml`, and `js-yaml`. */
export interface ReadBack {
  readonly yaml12: unknown;
  readonly yaml11: unknown;
  readonly jsYaml: unknown;
}

/**
 * Reads the texts back with the YAML parsers the tools of the workspace already install (`yaml`
 * through Vite, knip and the GitLab formatter of ESLint; `js-yaml` through commitlint), in a
 * process of its own run from the root of the repository. The CLI declares no YAML dependency,
 * not even for its tests: its writer is proven against readers it does not ship.
 */
const READ_BACK = `
import { text } from 'node:stream/consumers';
import YAML from 'yaml';
import jsyaml from 'js-yaml';

const texts = JSON.parse(await text(process.stdin));

process.stdout.write(JSON.stringify(texts.map((yaml) => ({
  yaml12: YAML.parse(yaml),
  yaml11: YAML.parse(yaml, { version: '1.1' }),
  jsYaml: jsyaml.load(yaml),
}))));
`;

export function readYaml(texts: readonly string[]): ReadBack[] {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', READ_BACK], {
    cwd: REPO_ROOT,
    input: JSON.stringify(texts),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`The YAML parsers failed: ${result.stderr}`);
  }

  const parsed: unknown = JSON.parse(result.stdout);

  return Array.isArray(parsed) ? parsed.filter(isReadBack) : [];
}

function isReadBack(value: unknown): value is ReadBack {
  return typeof value === 'object' && value !== null && 'yaml12' in value && 'yaml11' in value && 'jsYaml' in value;
}
