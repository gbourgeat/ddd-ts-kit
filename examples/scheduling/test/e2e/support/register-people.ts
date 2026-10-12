import { unwrap } from 'scheduling-api-client';
import type { RunningApplication } from '$test/e2e/support/start-application';

/** Each person registers themselves, as at their first sign-in, through the typed client of the contract. */
export async function registerPeople(application: RunningApplication, ...personIds: readonly string[]): Promise<void> {
  for (const personId of personIds) {
    const person = await application.apiAs({ id: personId });

    await unwrap(
      person.registerPerson({ body: { displayName: 'Name of ' + personId, email: personId + '@example.com' } }),
    );
  }
}
