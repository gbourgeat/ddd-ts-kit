import { ForbiddenError } from '@ddd-ts-kit/auth';
import { UseCaseGuard, type Resolve } from '@ddd-ts-kit/di';
import {
  Command,
  ErrorReporter,
  NoopErrorReporter,
  UnitOfWork,
  executionContext,
  type Session,
} from '@ddd-ts-kit/kernel';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { aSession } from '@ddd-ts-kit/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openTestDatabase, type TestDatabase } from '../database/open-test-database.js';
import { layFoundations, type Foundations } from '../lay-foundations.js';
import { createCommandBus } from './create-command-bus.js';

class RenamePractice extends Command {}

const ada = anActor().named('ada').build();
const firstPage = { kind: 'offset', offset: 0, limit: 10, sort: [] } as const;

describe('The command bus, for a session that impersonates', () => {
  let database: TestDatabase;
  let foundations: Foundations;
  let handled: number;

  beforeAll(async () => {
    database = await openTestDatabase();
    foundations = layFoundations(database.persistence, {});
  });

  beforeEach(() => {
    handled = 0;
  });

  afterAll(() => database.close());

  function send(session: Session, correlationId: string): Promise<unknown> {
    const bus = createCommandBus(resolverOver(database), foundations, {}).register(RenamePractice, {
      execute: async () => {
        handled += 1;
      },
    });

    return foundations.scope.run(
      executionContext({ correlationId, actor: session.actor, session, origin: 'http' }),
      () => bus.execute(new RenamePractice()),
    );
  }

  it('refuses every command with a stable reason, and the trail names the impersonator', async () => {
    const refused = send(aSession().of(ada).impersonatedBy('support-7').build(), 'impersonated');

    await expect(refused).rejects.toBeInstanceOf(ForbiddenError);
    await expect(refused).rejects.toMatchObject({ code: 'FORBIDDEN', reason: 'IMPERSONATION_READ_ONLY' });
    expect(handled).toBe(0);

    const { items } = await foundations.audit.trail.list({ correlationId: 'impersonated' }, firstPage);

    expect(items).toMatchObject([
      {
        category: 'command',
        action: 'RenamePractice',
        outcome: 'failed',
        reason: 'FORBIDDEN',
        actor: { id: 'ada' },
        impersonatedBy: 'support-7',
      },
    ]);
  });

  it('lets the command of an ordinary session through', async () => {
    await send(aSession().of(ada).build(), 'ordinary');

    expect(handled).toBe(1);

    const { items } = await foundations.audit.trail.list({ correlationId: 'ordinary' }, firstPage);

    expect(items).toMatchObject([{ action: 'RenamePractice', outcome: 'succeeded' }]);
    expect(items[0]?.impersonatedBy).toBeUndefined();
  });
});

/** What the bus resolves at each command: no permission is asked here, the spec is about what follows the guard. */
function resolverOver(database: TestDatabase): Resolve {
  const bound = new Map<unknown, unknown>([
    [ErrorReporter, new NoopErrorReporter()],
    [UnitOfWork, database.persistence.unitOfWork],
    [UseCaseGuard, { check: (_message: unknown, next: () => Promise<unknown>) => next() }],
  ]);

  const resolve: Resolve = (token) => bound.get(token) as never;

  return resolve;
}
