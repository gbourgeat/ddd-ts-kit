import type { Config } from '../config';
import { CODES_FILE } from '../context-files';

/** The code lists of every context, as knip is told of them: `<context>.codes.ts` at the root of each. */
export function codeTypesPattern(config: Config): string {
  return `${config.contextsDir}/*/${CODES_FILE.root('*')}`;
}
