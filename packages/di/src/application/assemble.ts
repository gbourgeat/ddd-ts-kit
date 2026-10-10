import { assertAuthorizationDeclared } from '../authorization/assert-authorization-declared.js';
import { assertSound } from '../checks/assert-sound.js';
import { effectiveJobs } from '../jobs/effective-jobs.js';
import { TokenSet } from '../token/token-set.js';
import type { Wiring } from '../wiring/wiring.js';
import type { ApplicationOptions } from './application-options.js';
import type { Application } from './application.js';
import { ContainerApplication } from './container-application.js';

/** `createApplication` for callers that already collected the wiring to inspect it. */
export function assemble(wiring: Wiring, options: ApplicationOptions): Application {
  const overrides = options.overrides ?? [];
  const overridden = new TokenSet(overrides.map(([target]) => target));

  assertSound(wiring, overridden);

  if (options.authorization === 'required') {
    assertAuthorizationDeclared(wiring, overridden);
  }

  return new ContainerApplication(wiring, options, effectiveJobs(wiring, options.jobs));
}
