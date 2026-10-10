import type { ChainableCommander, Redis } from 'ioredis';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { encode } from './codec/encode.js';
import { failureCode } from './errors/failure-code.js';
import { PublishNotConfirmedError } from './errors/publish-not-confirmed-error.js';
import type { DeduplicationOptions } from './options/deduplication-options.js';
import type { RetentionOptions } from './options/retention-options.js';

export interface PublicationSettings {
  readonly streamOf: (type: string) => string;
  readonly retention: RetentionOptions | undefined;
  readonly deduplication: DeduplicationOptions | undefined;
}

/**
 * Appends unless the event id was appended within the window, and answers the entry id either
 * way. The append comes first: were the mark written first, a failed append would make the
 * retry believe the event is there. KEYS: mark, stream. ARGV: window, then the arguments of
 * `XADD` after the key.
 */
const GUARDED_APPEND = `
local known = redis.call('GET', KEYS[1])
if known then
  return known
end
local entry = redis.call('XADD', KEYS[2], unpack(ARGV, 2))
redis.call('SET', KEYS[1], entry, 'PX', ARGV[1])
return entry`;

/**
 * Publishing: one `XADD` per event, the whole batch in one `MULTI`. A publication succeeds
 * only once the server answered an entry id for every event, which is what lets an outbox
 * relay mark them published.
 */
export class Publications {
  constructor(private readonly settings: PublicationSettings) {}

  /** Resolves when every event has an entry; rejects with the first failure otherwise. */
  async publish(client: Redis, events: readonly IntegrationEvent[]): Promise<void> {
    const transaction = client.multi();

    for (const event of events) {
      this.append(transaction, event);
    }

    const answers = await executed(transaction, events);

    events.forEach((event, index) => {
      const [error, entryId] = answers[index] ?? [new Error('no answer'), undefined];

      if (error !== null) throw new PublishNotConfirmedError(event.id, failureCode(error));

      if (typeof entryId !== 'string') throw new PublishNotConfirmedError(event.id, 'NO_ENTRY_ID');
    });
  }

  private append(transaction: ChainableCommander, event: IntegrationEvent): void {
    const stream = this.settings.streamOf(event.type);
    const entry = [...trimming(this.settings.retention), '*', ...encode(event)];
    const { deduplication } = this.settings;

    if (deduplication === undefined) {
      transaction.call('XADD', stream, ...entry);
    } else {
      transaction.eval(GUARDED_APPEND, 2, `${stream}:${event.id}:published`, stream, deduplication.windowMs, ...entry);
    }
  }
}

type Answers = readonly (readonly [error: Error | null, result: unknown])[];

/** A transaction the server did not answer, or refused as a whole, confirms none of its events. */
async function executed(transaction: ChainableCommander, events: readonly IntegrationEvent[]): Promise<Answers> {
  try {
    return (await transaction.exec()) ?? [];
  } catch (error) {
    throw new PublishNotConfirmedError(events[0]?.id ?? '', failureCode(error));
  }
}

function trimming(retention: RetentionOptions | undefined): string[] {
  if (retention === undefined) return [];

  if ('maxLength' in retention) return ['MAXLEN', '~', String(retention.maxLength)];

  return ['MINID', '~', `${String(Date.now() - retention.maxAgeMs)}-0`];
}
