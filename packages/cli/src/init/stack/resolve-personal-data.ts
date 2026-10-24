import { EVENT_SOURCING_MODES, PRIVACY_MODES } from '../../config';
import { CliError } from '../../cli-error';
import { WITH_DATABASE } from '../../stack/with-database';
import { choose } from './choose';
import type { StackOptions } from './stack-options';

/**
 * The event store is wired when asked for, since keeping an aggregate as its events is a choice
 * made per aggregate, and a project that makes it nowhere pays no table for it; it runs on the
 * PostgreSQL event store of the four ORM packages, or in memory without a database, so a custom
 * storage is refused with what to bind instead. The requests of a data subject are answered as
 * soon as there is a storage that may hold a person; without one, nothing is kept to erase.
 */
export function resolvePersonalData(options: StackOptions, orm: string): Record<'eventSourcing' | 'privacy', string> {
  const eventSourcing = choose(EVENT_SOURCING_MODES, options.eventSourcing, 'event-sourcing') ?? 'off';

  if (eventSourcing === 'on' && orm === 'custom') {
    throw new CliError(
      '--event-sourcing on cannot be combined with --orm custom.',
      `The event store of the kit runs on PostgreSQL through ${WITH_DATABASE.map((name) => `@ddd-ts-kit/${name}`).join(', ')}: pick one of them, or keep --event-sourcing off and bind EventStore, SnapshotStore, CheckpointStore and SubjectKeyStore to stores of your own, held by eventStoreContract of @ddd-ts-kit/testing.`,
    );
  }

  return {
    eventSourcing,
    privacy: choose(PRIVACY_MODES, options.privacy, 'privacy') ?? (orm === 'none' ? 'off' : 'on'),
  };
}
