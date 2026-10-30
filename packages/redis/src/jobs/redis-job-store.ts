import { inspect } from 'node:util';
import type { Redis } from 'ioredis';
import { whenCommitted, type EnqueuedJob, type QueuedJob } from '@ddd-ts-kit/kernel';
import {
  tenantKeyOf,
  type ClaimedJob,
  type ClaimRequest,
  type JobFailure,
  type JobLease,
  type JobStore,
  type JobStoreStats,
  type JobUpdate,
  type NewJob,
} from '@ddd-ts-kit/scheduling';
import { listOf } from '../replies/list-of';
import { conceal } from '../secrecy/conceal';
import { claimedJobOfRecord } from './claimed-job-of-record';
import { ADD_JOB, CLAIM_JOBS, ERASE_JOB, PURGE_JOBS, TRANSITION_JOB } from './job-scripts';
import { parseJobRecord } from './parse-job-record';
import { queuedJobOfRecord } from './queued-job-of-record';
import type { RedisJobRecord } from './redis-job-record';
import type { RedisJobStoreOptions } from './redis-job-store-options';

const DESCRIPTION = 'RedisJobStore [client concealed]';

/** The field of the records hash that holds the counter of the claim order. */
const SEQUENCE_FIELD = '#sequence';

/** A change of a record: fields set, `false` removes one, `attemptsDelta` moves the count. */
type Change = Readonly<Record<string, unknown>>;

interface Transition {
  readonly id: string;
  /** The statuses the record may be in, space separated. */
  readonly from: string;
  /** The attempt that must hold the record, when one must. */
  readonly attempt?: number;
  readonly change: Change;
}

/**
 * The background jobs on Redis, Dragonfly or Valkey, in a few Lua scripts: no dependency but the
 * client of the package. Redis cannot join the transaction of the database: inside a unit of
 * work, `add`, `cancel` and `retryDead` answer from what Redis holds and write once it committed
 * (`whenCommitted`), so a command that rolls back leaves no job and cancels none, and a crash
 * between the commit and the write loses that write. Every key carries the namespace in braces,
 * so that a cluster keeps them in one slot.
 */
export class RedisJobStore implements JobStore {
  private readonly client: Redis;

  private readonly prefix: string;

  private readonly onLostJob: (error: unknown, jobId: string) => void;

  constructor(client: Redis, options: RedisJobStoreOptions = {}) {
    this.client = client;
    this.prefix = `{${options.namespace ?? 'jobs'}}`;
    this.onLostJob = options.onLostJob ?? (() => undefined);
    conceal(this);
  }

  async add(job: NewJob): Promise<EnqueuedJob> {
    const field =
      job.idempotencyKey === undefined
        ? ''
        : JSON.stringify([job.name, tenantKeyOf(job.enqueuedBy), job.idempotencyKey]);

    const kept = field === '' ? null : await this.client.hget(this.key('keys'), field);

    if (kept !== null) {
      return { id: kept, duplicate: true };
    }

    await whenCommitted(
      () => this.write(job, field),
      (error) => {
        this.onLostJob(error, job.id);
      },
    );

    return { id: job.id, duplicate: false };
  }

  async claim({ queue, limit, now, leaseMs }: ClaimRequest): Promise<ClaimedJob[]> {
    if (limit <= 0) {
      return [];
    }

    const keys = [this.key('records'), this.key('waiting', queue), this.key('running', queue)];
    const leaseUntil = now.getTime() + leaseMs;
    const claimed: unknown = await this.client.eval(CLAIM_JOBS, keys.length, ...keys, now.getTime(), limit, leaseUntil);

    return listOf(claimed)
      .filter((raw) => typeof raw === 'string')
      .map((raw) => claimedJobOfRecord(parseJobRecord(raw)));
  }

  heartbeat(lease: JobLease, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, { leaseUntil: leaseUntil.getTime() });
  }

  update(lease: JobLease, update: JobUpdate, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, {
      leaseUntil: leaseUntil.getTime(),
      ...(update.progress === undefined ? {} : { progress: update.progress }),
      ...('checkpoint' in update ? { checkpoint: jsonOrFalse(update.checkpoint) } : {}),
    });
  }

  complete(lease: JobLease, at: Date): Promise<boolean> {
    return this.holding(lease, { status: 'succeeded', finishedAt: at.getTime(), leaseUntil: false });
  }

  fail(lease: JobLease, { errorCode, retryAt, at }: JobFailure): Promise<boolean> {
    const next =
      retryAt === null ? { status: 'dead', finishedAt: at.getTime() } : { status: 'waiting', runAt: retryAt.getTime() };

    return this.holding(lease, { ...next, leaseUntil: false, lastErrorCode: errorCode });
  }

  release(lease: JobLease, runAt: Date): Promise<boolean> {
    return this.holding(lease, { status: 'waiting', runAt: runAt.getTime(), leaseUntil: false, attemptsDelta: -1 });
  }

  async cancel(id: string, at: Date): Promise<boolean> {
    const status = (await this.record(id))?.status;

    if (status !== 'waiting' && status !== 'running') {
      return false;
    }

    const change = { status: 'cancelled', finishedAt: at.getTime(), leaseUntil: false };

    return this.afterCommit(true, [id], () => this.transition({ id, from: 'waiting running', change }));
  }

  async find(id: string): Promise<QueuedJob | undefined> {
    const record = await this.record(id);

    return record === undefined ? undefined : queuedJobOfRecord(record);
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    const records = await Promise.all(ids.map((id) => this.record(id)));
    const dead = records.flatMap((record) => (record?.status === 'dead' ? [record.id] : []));

    return this.afterCommit(dead.length, dead, () => this.revive(dead, now));
  }

  async purgeFinished(before: Date): Promise<number> {
    const keys = [this.key('records'), this.key('finished'), this.key('keys')];

    return Number(await this.client.eval(PURGE_JOBS, keys.length, ...keys, before.getTime()));
  }

  async eraseSubject(subject: string): Promise<number> {
    const held = (await this.records()).filter((record) => record.subject === subject);

    return this.afterCommit(
      held.length,
      held.map(({ id }) => id),
      () => this.erase(held),
    );
  }

  async stats(queue: string): Promise<JobStoreStats> {
    const [waiting, running, dead] = await Promise.all(
      ['waiting', 'running', 'dead'].map((set) => this.client.zcard(this.key(set, queue))),
    );

    return { waiting: waiting ?? 0, running: running ?? 0, dead: dead ?? 0 };
  }

  /** What a serialisation shows: a name, never the client, whose options carry the password. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  private async write(job: NewJob, field: string): Promise<void> {
    const keys = [this.key('records'), this.key('waiting', job.queue), this.key('keys')];
    const runAt = job.runAt.getTime();

    const record = {
      id: job.id,
      name: job.name,
      queue: job.queue,
      payload: jsonOrFalse(job.payload) || 'null',
      enqueuedBy: JSON.stringify(job.enqueuedBy),
      ...(field === '' ? {} : { key: field }),
      ...(job.enqueuedBy.tenantId === undefined ? {} : { tenantId: job.enqueuedBy.tenantId }),
      ...(job.subject === undefined ? {} : { subject: job.subject }),
      status: 'waiting',
      attempts: 0,
      runAt,
      enqueuedAt: job.enqueuedAt.getTime(),
    };

    await this.client.eval(ADD_JOB, keys.length, ...keys, job.id, JSON.stringify(record), field, runAt);
  }

  /**
   * Inside a unit of work, `write` waits for the commit and `expected` is the answer; anywhere
   * else, it runs at once and its own answer is.
   */
  private async afterCommit<T>(expected: T, ids: readonly string[], write: () => Promise<T>): Promise<T> {
    let answer = expected;

    await whenCommitted(
      async () => {
        answer = await write();
      },
      (error) => {
        for (const id of ids) {
          this.onLostJob(error, id);
        }
      },
    );

    return answer;
  }

  private async erase(records: readonly RedisJobRecord[]): Promise<number> {
    let erased = 0;

    for (const { id, queue } of records) {
      const keys = [
        this.key('records'),
        ...['waiting', 'running', 'dead'].map((set) => this.key(set, queue)),
        this.key('finished'),
        this.key('keys'),
      ];

      erased += Number(await this.client.eval(ERASE_JOB, keys.length, ...keys, id));
    }

    return erased;
  }

  private async revive(ids: readonly string[], now: Date): Promise<number> {
    let revived = 0;

    for (const id of ids) {
      const change = { status: 'waiting', runAt: now.getTime(), finishedAt: false, attempts: 0 };

      revived += (await this.transition({ id, from: 'dead', change })) ? 1 : 0;
    }

    return revived;
  }

  private holding(lease: JobLease, change: Change): Promise<boolean> {
    return this.transition({ id: lease.id, from: 'running', attempt: lease.attempt, change });
  }

  /** The queue of a job never changes: it is read first, to name the keys the script may touch. */
  private async transition({ id, from, attempt, change }: Transition): Promise<boolean> {
    const record = await this.record(id);

    if (record === undefined) {
      return false;
    }

    const keys = [
      this.key('records'),
      ...['waiting', 'running', 'dead'].map((set) => this.key(set, record.queue)),
      this.key('finished'),
    ];

    const held = attempt === undefined ? '' : String(attempt);

    const applied = await this.client.eval(
      TRANSITION_JOB,
      keys.length,
      ...keys,
      id,
      from,
      held,
      JSON.stringify(change),
    );

    return Number(applied) === 1;
  }

  /** Every record of the namespace: the store keeps no index of the subjects, and an erasure is rare. */
  private async records(): Promise<RedisJobRecord[]> {
    const fields = await this.client.hgetall(this.key('records'));

    return Object.entries(fields)
      .filter(([field]) => field !== SEQUENCE_FIELD)
      .map(([, raw]) => parseJobRecord(raw));
  }

  private async record(id: string): Promise<RedisJobRecord | undefined> {
    const raw = await this.client.hget(this.key('records'), id);

    return raw === null ? undefined : parseJobRecord(raw);
  }

  private key(...parts: readonly string[]): string {
    return [this.prefix, ...parts].join(':');
  }
}

/** JSON of a value, or `false` (the field is removed) for `undefined`, which JSON cannot write. */
function jsonOrFalse(value: unknown): string | false {
  return value === undefined ? false : JSON.stringify(value);
}
