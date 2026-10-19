import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeAuthenticator } from '@ddd-ts-kit/auth/testing';
import { declaredTokens } from '@ddd-ts-kit/di';
import { declarationOf } from '@ddd-ts-kit/kernel/declarations';
import { composeApplication, type Application } from '@/platform/composition/compose-application';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { inProcessEvents } from '@/platform/events/in-process-events';
import * as identityDeclarations from '@/contexts/identity/identity.declarations';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import * as notificationDeclarations from '@/contexts/notification/notification.declarations';
import * as analyticsDeclarations from '@/contexts/analytics/analytics.declarations';

const contexts = [
  ['identity', identityDeclarations],
  ['scheduling', schedulingDeclarations],
  ['notification', notificationDeclarations],
  ['analytics', analyticsDeclarations],
] as const;

let database: TestDatabase;
let application: Application;

beforeAll(async () => {
  database = await openTestDatabase();

  application = composeApplication(database.persistence, {
    events: inProcessEvents(),
    authenticator: new FakeAuthenticator({}),
  });
});

afterAll(async () => {
  await database.close();
});

/**
 * No class lists what it depends on: its constructor states it, and the generated file of its
 * context registers what was read from it. The composition root as `main.ts` builds it, on a
 * real storage, then builds every class of every context: a list that is missing, of another
 * length or naming something nobody binds stops here, by name.
 */
describe('Every declared class of every context is built by the composition root', () => {
  it.each(contexts)(
    '%s: each class resolves, given one dependency per constructor parameter',
    (_name, declarations) => {
      const tokens = declaredTokens(declarations);
      const built = tokens.map((token) => application.container.resolve(token));

      expect(tokens.length).toBeGreaterThan(0);
      expect(built.every((instance) => typeof instance === 'object' && instance !== null)).toBe(true);
    },
  );

  it.each(contexts)('%s: no decorator repeats what a constructor says', (_name, declarations) => {
    const listed = Object.values(declarations).filter((value) => {
      const declaration = declarationOf(value);

      return declaration !== undefined && 'dependencies' in declaration && declaration.dependencies !== undefined;
    });

    expect(listed).toEqual([]);
  });
});
