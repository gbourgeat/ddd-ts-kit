import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE } from '../config/config-file';
import { parseConfig } from '../config/parse-config';

/** What `openapi.format` of the config says, for the scripts that write the contracts: `yaml` or `json`. */
export function contractFormat(root = process.cwd()): 'yaml' | 'json' {
  const file = path.join(root, CONFIG_FILE);
  const raw: unknown = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};

  return parseConfig(raw).openapi.format === 'json' ? 'json' : 'yaml';
}
