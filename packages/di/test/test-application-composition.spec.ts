import { describe, expect, it } from 'vitest';
import { Clock, FixedClock } from '@ddd-ts-kit/kernel';
import {
  createApplication,
  createTestApplication,
  kernelModule,
  overrideForTests,
  type Application,
} from '../src/index.js';
import { createTestKernel } from '../src/testing/create-test-kernel.js';
import { testApplicationOf } from '../src/testing/test-application-of.js';
import type { Resolve } from '../src/wiring/resolve.js';
import { orderingModule } from './support/ordering/ordering.module.js';

/** An application whose private fields bear the names of members of the test kernel. */
class ApplicationNamedLikeTheKernel implements Application {
  private readonly jobs = ['nightly-export'];

  private readonly clock = 'wall clock';

  private readonly cache = new Map([['warm', 'yes']]);

  private readonly errors: string[] = [];

  constructor(private readonly inner: Application) {}

  get container(): Application['container'] {
    return this.inner.container;
  }

  readonly resolve: Resolve = (target) => this.inner.resolve(target);

  async start(): Promise<void> {
    this.errors.push(`${this.jobs.join()} started by the ${this.clock}, cache warm: ${this.cache.get('warm') ?? 'no'}`);
  }

  async stop(): Promise<void> {
    this.errors.length = 0;
  }

  describe(): ReturnType<Application['describe']> {
    return this.inner.describe();
  }

  journal(): readonly string[] {
    return this.errors;
  }
}

describe('the test application, in front of the application', () => {
  const composed = () => {
    const application = new ApplicationNamedLikeTheKernel(
      createApplication({ modules: [kernelModule(), orderingModule] }),
    );

    const kernel = createTestKernel({ modules: [] }, application.resolve);

    return { application, kernel, front: testApplicationOf(application, kernel) };
  };

  it('leaves the fields of the application alone when they are named like members of the kernel', async () => {
    const { application, kernel, front } = composed();

    await front.start();

    expect(application.journal()).toEqual(['nightly-export started by the wall clock, cache warm: yes']);
    expect(front.jobs).toBe(kernel.jobs);
    expect(front.clock).toBe(kernel.clock);
    expect(front.cache).toBe(kernel.cache);
    expect(front.errors).toBe(kernel.errors);
  });

  it('writes nothing on the application', () => {
    const application = new ApplicationNamedLikeTheKernel(
      createApplication({ modules: [kernelModule(), orderingModule] }),
    );

    const before = Object.entries(application);

    const front = testApplicationOf(application, createTestKernel({ modules: [] }, application.resolve));

    expect(front).not.toBe(application);
    expect(Object.entries(application)).toEqual(before);
  });

  it('calls the application for what the application does', async () => {
    const { application, front } = composed();

    await front.start();
    await front.stop();

    expect(application.journal()).toEqual([]);
    expect(front.describe()).toEqual(application.describe());
    expect(front.container).toBe(application.container);
    expect(front.get(Clock)).toBe(application.resolve(Clock));
  });
});

describe('createTestApplication', () => {
  it('keeps its shape: the application, the test kernel, get and as', () => {
    const app = createTestApplication({ modules: [orderingModule] });

    expect(Object.keys(app).sort()).toEqual([
      'actorContext',
      'as',
      'backgroundJobs',
      'cache',
      'clock',
      'commandBus',
      'container',
      'describe',
      'domainEvents',
      'errors',
      'eventBus',
      'executionScope',
      'get',
      'ids',
      'jobQueue',
      'jobs',
      'lock',
      'logger',
      'metrics',
      'processes',
      'queryBus',
      'rateLimiter',
      'resolve',
      'start',
      'stop',
    ]);

    expect(app.get).toBe(app.resolve);
  });

  it('still takes a binding swapped in with overrideForTests', () => {
    const app = createTestApplication({ modules: [orderingModule] });
    const later = new FixedClock(new Date('2030-01-01T00:00:00.000Z'));

    overrideForTests(app, Clock, later);

    expect(app.get(Clock)).toBe(later);
  });
});
