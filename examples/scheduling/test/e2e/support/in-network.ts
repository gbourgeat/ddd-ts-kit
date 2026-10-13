import type { RunningApplication } from '$test/e2e/support/start-application';

/** The same application, as the people of another network reach it: every actor's token names `network` unless it says otherwise. */
export function inNetwork(application: RunningApplication, network: string): RunningApplication {
  return { ...application, as: (actor) => application.as({ tenantId: network, ...actor }) };
}
