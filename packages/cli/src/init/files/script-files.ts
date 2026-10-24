import type { Config } from '../../config';
import { familyOf } from './family-of';
import type { InitFile } from './init-file';
import { when } from './when';

/** The contracts and, with `--privacy on`, the two requests of a data subject the platform answers from the command line and its purge. */
export function scriptFiles(config: Config): InitFile[] {
  const family = familyOf(config);

  return [
    ...when(config.stack.http !== 'none', [['scripts/openapi.ts', 'init/scripts/openapi.ts.tpl']]),
    ['scripts/events.ts', 'init/scripts/events.ts.tpl'],
    ...when(config.stack.privacy === 'on', [
      ['scripts/privacy-erase.ts', `init/scripts/privacy-erase.${family}.ts.tpl`],
      ['scripts/privacy-export.ts', `init/scripts/privacy-export.${family}.ts.tpl`],
      ['scripts/privacy-purge.ts', `init/scripts/privacy-purge.${family}.ts.tpl`],
    ]),
  ];
}
