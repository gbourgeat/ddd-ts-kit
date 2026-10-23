import type { Config } from '../../config';
import type { InitFile } from './init-file';
import { when } from './when';

export function scriptFiles(config: Config): InitFile[] {
  return [
    ...when(config.stack.http !== 'none', [['scripts/openapi.ts', 'init/scripts/openapi.ts.tpl']]),
    ['scripts/events.ts', 'init/scripts/events.ts.tpl'],
  ];
}
