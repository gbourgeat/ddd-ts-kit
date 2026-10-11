import { expectStatus } from '@ddd-ts-kit/testing/e2e';
import type { RunningApplication } from '$test/e2e/support/start-application';

/** Each person registers themselves, as at their first sign-in. */
export async function registerPeople(application: RunningApplication, ...personIds: readonly string[]): Promise<void> {
  for (const personId of personIds) {
    const person = await application.as({ id: personId });

    expectStatus(
      await person.put('/people/me', { displayName: 'Name of ' + personId, email: personId + '@example.com' }),
      200,
    );
  }
}
