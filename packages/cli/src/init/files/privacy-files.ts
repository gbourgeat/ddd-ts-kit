import type { Config } from '../../config';
import { familyOf } from './family-of';
import type { InitFile } from './init-file';
import { platformFile } from './platform-file';
import { when } from './when';

/**
 * The personal data as a capability of the platform: the keys of the data subjects and the cipher
 * of the stored events, the lists of the copies and of the exports each context declares, and the
 * erasure and the export the two scripts run. Nothing here is a bounded context, and a project
 * without personal data pays an empty list.
 */
export function privacyFiles(config: Config): InitFile[] {
  const family = familyOf(config);
  const file = (name: string, variant?: string): InitFile => platformFile(config, name, variant);

  return [
    file('privacy/create-privacy.ts'),
    ...when(family === 'tsyringe', [file('privacy/privacy.module.ts')]),
    file('privacy/data-subject-copies.ts', family),
    file('privacy/data-subject-exports.ts', family),
    file('privacy/run-erasure.ts', family),
    file('privacy/run-export.ts', family),
  ];
}
