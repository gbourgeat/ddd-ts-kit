import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';
import { when } from './when.js';

export function scriptFiles(config: Config): InitFile[] {
  return [
    ...when(config.stack.http !== 'none', [['scripts/openapi.ts', 'init/scripts/openapi.ts.tpl']]),
    ['scripts/events.ts', 'init/scripts/events.ts.tpl'],
  ];
}
