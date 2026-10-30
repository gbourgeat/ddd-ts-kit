import type { Config } from '../../config';
import { familyOf } from './family-of';
import type { InitFile } from './init-file';
import { platformFile } from './platform-file';

/**
 * The requests of a data subject as a capability of the platform, with `--privacy on`: the lists
 * of the copies and of the exports each context declares, the events that carry personal data, the
 * erasure and the export the two scripts run, and the purge of what outlived its retention, run every night. Nothing here is a bounded context, and a project that declares nothing pays an
 * empty list; a project without personal data takes `--privacy off` and pays nothing.
 */
export function privacyFiles(config: Config): InitFile[] {
  if (config.stack.privacy !== 'on') {
    return [];
  }

  const family = familyOf(config);
  const file = (name: string): InitFile => platformFile(config, `privacy/${name}`, family);

  return [
    file('data-subject-copies.ts'),
    file('data-subject-exports.ts'),
    file('run-erasure.ts'),
    file('run-export.ts'),
    file('run-purge.ts'),
    ...(config.stack.events === 'outbox' ? [platformFile(config, 'privacy/personal-events.ts')] : []),
    ...(family === 'tsyringe' ? [file('privacy.module.ts')] : []),
  ];
}
