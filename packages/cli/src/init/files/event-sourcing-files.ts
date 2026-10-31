import type { Config } from '../../config';
import { familyOf } from './family-of';
import type { InitFile } from './init-file';
import { platformFile } from './platform-file';
import { when } from './when';

/**
 * The event store as a capability of the platform, with `--event-sourcing on`: the stores an
 * event-sourced repository adapter is given, the keys of the data subjects and the cipher of the
 * stored events, built on the foundations and, on tsyringe, bound by a module of their own.
 */
export function eventSourcingFiles(config: Config): InitFile[] {
  if (config.stack.eventSourcing !== 'on') {
    return [];
  }

  return [
    platformFile(config, 'event-sourcing/create-event-sourcing.ts'),
    ...when(familyOf(config) === 'container', [platformFile(config, 'event-sourcing/event-sourcing.module.ts')]),
  ];
}
