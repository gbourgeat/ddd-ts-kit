import type { Config } from '../../config';
import { auditVars } from '../../stack/audit-vars';
import { WITH_DATABASE } from '../../stack/with-database';
import { familyOf } from './family-of';
import type { InitFile } from './init-file';
import { when } from './when';

/**
 * The contracts; with `--privacy on`, the two requests of a data subject the platform answers from
 * the command line and its purge; with an audit trail in the database, its verification; with a
 * database, the check of its read model tables.
 */
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
    ...when(auditVars(config)['sql'] === true, [['scripts/audit-verify.ts', 'init/scripts/audit-verify.ts.tpl']]),
    ...when(WITH_DATABASE.includes(config.stack.orm), [
      ['scripts/read-model-tables.ts', 'init/scripts/read-model-tables.ts.tpl'],
    ]),
  ];
}
