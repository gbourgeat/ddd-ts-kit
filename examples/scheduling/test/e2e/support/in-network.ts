import type { TestActor } from '$test/e2e/support/create-credentials';
import type { RunningApplication } from '$test/e2e/support/start-application';

/**
 * The same application, as the people of another network reach it: every credential it builds
 * (raw client, headers, typed client) names `network` unless the actor says otherwise.
 */
export function inNetwork(application: RunningApplication, network: string): RunningApplication {
  const ofNetwork = (actor: TestActor): TestActor => ({ tenantId: network, ...actor });

  return {
    ...application,
    as: (actor) => application.as(ofNetwork(actor)),
    headersOf: (actor) => application.headersOf(ofNetwork(actor)),
    apiAs: (actor) => application.apiAs(ofNetwork(actor)),
  };
}
