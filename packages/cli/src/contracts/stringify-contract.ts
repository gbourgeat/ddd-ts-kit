import { toYaml } from '../yaml/to-yaml.js';

/** The exact bytes of a generated contract: YAML, or two-space JSON; both end with one line break. */
export function stringifyContract(document: unknown, format: string): string {
  return format === 'json' ? `${JSON.stringify(document, null, 2)}\n` : toYaml(document);
}
