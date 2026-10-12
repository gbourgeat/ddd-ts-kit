import { read } from '../helpers.js';
import { readYaml } from './read-yaml.js';

/** A generated contract as data, whether it is written in YAML or in JSON. */
export function readContract(root: string, file: string): unknown {
  const text = read(root, file);

  return file.endsWith('.json') ? JSON.parse(text) : readYaml([text])[0]?.yaml12;
}
