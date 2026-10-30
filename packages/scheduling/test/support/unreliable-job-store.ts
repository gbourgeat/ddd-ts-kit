import { InMemoryJobStore, type ClaimRequest, type ClaimedJob, type JobLease } from '../../src';
import type { QueuedJob } from '@ddd-ts-kit/kernel';

class StoreDown extends Error {
  readonly code = 'STORE_DOWN';
}

/** The in-memory store, whose operations a spec makes fail a number of times. */
export class UnreliableJobStore extends InMemoryJobStore {
  /** How many times a job was read by its id. */
  finds = 0;

  failingClaims = 0;

  failingHeartbeats = 0;

  failingWrites = 0;

  /** A claim waits for it, then fails, when it is set. */
  stalledClaim: Promise<void> | undefined;

  /** A claim waits for it, then claims, when it is set. */
  heldClaim: Promise<void> | undefined;

  override async find(id: string): Promise<QueuedJob | undefined> {
    this.finds += 1;

    return super.find(id);
  }

  override async claim(request: ClaimRequest): Promise<ClaimedJob[]> {
    await this.heldClaim;

    if (this.stalledClaim !== undefined) {
      await this.stalledClaim;
      throw 'claim refused';
    }

    if (this.failingClaims > 0) {
      this.failingClaims -= 1;
      throw new StoreDown('claim');
    }

    return super.claim(request);
  }

  override async heartbeat(lease: JobLease, leaseUntil: Date): Promise<boolean> {
    if (this.failingHeartbeats > 0) {
      this.failingHeartbeats -= 1;
      throw new StoreDown('heartbeat');
    }

    return super.heartbeat(lease, leaseUntil);
  }

  override async complete(lease: JobLease, at: Date): Promise<boolean> {
    this.refuseAWrite();

    return super.complete(lease, at);
  }

  override async fail(lease: JobLease, failure: Parameters<InMemoryJobStore['fail']>[1]): Promise<boolean> {
    this.refuseAWrite();

    return super.fail(lease, failure);
  }

  private refuseAWrite(): void {
    if (this.failingWrites > 0) {
      this.failingWrites -= 1;
      throw new StoreDown('write');
    }
  }
}
