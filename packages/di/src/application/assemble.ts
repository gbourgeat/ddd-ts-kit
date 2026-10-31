import { assertAuthorizationDeclared } from '../authorization/assert-authorization-declared';
import { assertSound } from '../checks/assert-sound';
import { effectiveJobs } from '../jobs/effective-jobs';
import { TokenSet } from '../token/token-set';
import type { Wiring } from '../wiring/wiring';
import type { ApplicationOptions } from './application-options';
import type { Application } from './application';
import type { Container } from './container';
import { ContainerApplication } from './container-application';

/** `createApplication` for callers that already collected the wiring to inspect it. */
export function assemble<Native>(
  container: Container<Native>,
  wiring: Wiring,
  options: ApplicationOptions,
): Application<Native> {
  const overrides = options.overrides ?? [];
  const overridden = new TokenSet(overrides.map(([target]) => target));

  assertSound(wiring, overridden);

  if (options.authorization === 'required') {
    assertAuthorizationDeclared(wiring, overridden);
  }

  return new ContainerApplication(container, wiring, options, effectiveJobs(wiring, options.jobs));
}
