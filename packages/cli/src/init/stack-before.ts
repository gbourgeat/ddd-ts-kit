import { readConfig, type Config } from '../config';

/** The stack the config on disk records, before this run rewrites it, when it can be read. */
export function stackBefore(root: string): Config['stack'] | undefined {
  try {
    return readConfig(root).config.stack;
  } catch {
    return undefined;
  }
}
