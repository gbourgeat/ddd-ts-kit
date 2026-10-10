import type { KafkaJS } from '@confluentinc/kafka-javascript';
import type { BrokerLink } from './broker-link.js';
import { REPLAY_FOR_HEADER, republication } from './codec.js';
import type { Publications } from './publications.js';
import { deadTopicOf, replayGroupOf } from './topology.js';

export interface ReplayPlan {
  readonly consumer: string;
  /** The topic the dead letters came from and go back to. */
  readonly topic: string;
  readonly limit: number;
  /** How long the replay may take before it returns what it moved so far. */
  readonly timeoutMs: number;
}

/**
 * Copies dead letters back to the topic they came from, marked for the one consumer that
 * gave up on them. The offsets the replay group commits on the dead-letter topic are the
 * record of what was replayed: the lag of that group is the number of dead letters waiting.
 */
export class DeadLetterReplay {
  readonly #dead: string;
  readonly #group: string;
  #replayed = 0;

  constructor(
    private readonly link: BrokerLink,
    private readonly publications: Publications,
    private readonly plan: ReplayPlan,
  ) {
    this.#dead = deadTopicOf(plan.consumer, plan.topic);
    this.#group = replayGroupOf(plan.consumer);
  }

  /** Returns how many records were moved. */
  async run(): Promise<number> {
    const target = Math.min(this.plan.limit, await this.#waiting());
    if (target <= 0) {
      return 0;
    }
    const client = await this.link.connected(this.link.consumer(this.#group, ignore));
    try {
      await client.subscribe({ topics: [this.#dead] });
      await this.#moved(client, target);
    } finally {
      await client.disconnect().catch(ignore);
    }
    return this.#replayed;
  }

  async #waiting(): Promise<number> {
    const admin = await this.link.admin();
    const ends = await this.link.answered(admin.fetchTopicOffsets(this.#dead));
    const groupId = this.#group;
    const [committed] = await this.link.answered(admin.fetchOffsets({ groupId, topics: [this.#dead] }));
    const positions = new Map(committed?.partitions.map(({ partition, offset }) => [partition, BigInt(offset)]));
    let waiting = 0n;
    for (const { partition, high, low } of ends) {
      const position = positions.get(partition) ?? -1n;
      waiting += BigInt(high) - (position < BigInt(low) ? BigInt(low) : position);
    }
    return Number(waiting);
  }

  #moved(client: KafkaJS.Consumer, target: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, this.plan.timeoutMs);
      const finished = (): void => {
        clearTimeout(timer);
        resolve();
      };
      const eachMessage = async (delivery: KafkaJS.EachMessagePayload): Promise<void> => {
        const moved = this.#replayed < target && (await this.#move(client, delivery));
        if (this.#replayed >= target || !moved) {
          finished();
        }
        if (!moved) {
          delivery.pause();
          throw new ReplayStopped();
        }
      };
      void client.run({ eachMessage }).catch(finished);
    });
  }

  /** Acknowledged copy first, commit second: a crash in between replays the record twice. */
  async #move(client: KafkaJS.Consumer, delivery: KafkaJS.EachMessagePayload): Promise<boolean> {
    const { topic, partition, message } = delivery;
    const marked = { [REPLAY_FOR_HEADER]: this.plan.consumer };
    try {
      await this.publications.send(republication(delivery, this.plan.topic, marked));
      await client.commitOffsets([{ topic, partition, offset: String(BigInt(message.offset) + 1n) }]);
    } catch {
      return false;
    }
    this.#replayed += 1;
    return true;
  }
}

/** Tells the client to leave the record where it is; the partition was paused beforehand. */
class ReplayStopped extends Error {
  readonly code = 'REPLAY_STOPPED';

  constructor() {
    super('The replay is over');
    this.name = 'ReplayStopped';
  }
}

function ignore(): undefined {
  return undefined;
}
