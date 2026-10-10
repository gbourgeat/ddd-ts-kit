import { DECLARED } from './declared.js';
import type { FixtureFiles } from './fixture-files.js';
import { PATHS } from './paths.js';
import { SAMPLES } from './samples.js';

/** One file of each role, with the ports they name and the specs the other rules ask for. */
export const DECLARED_CONTEXT: FixtureFiles = {
  [PATHS.REPOSITORY_PORT]: DECLARED.repositoryPort,
  [PATHS.PORT]: DECLARED.port,
  [PATHS.COMMAND]: DECLARED.command,
  [PATHS.HANDLER]: DECLARED.handler,
  [PATHS.HANDLER_SPEC]: SAMPLES.SPEC,
  [PATHS.QUERY]: DECLARED.query,
  [PATHS.QUERY_HANDLER]: DECLARED.queryHandler,
  [PATHS.QUERY_HANDLER_SPEC]: SAMPLES.SPEC,
  [PATHS.INTEGRATION_HANDLER]: DECLARED.integrationHandler,
  [PATHS.INTEGRATION_HANDLER_SPEC]: SAMPLES.SPEC,
  [PATHS.EVENT]: DECLARED.event,
  [PATHS.EVENT_HANDLER]: DECLARED.eventHandler,
  [PATHS.EVENT_HANDLER_SPEC]: SAMPLES.SPEC,
  [PATHS.PUBLISHER]: DECLARED.publisher,
  [PATHS.POLICY]: DECLARED.policy,
  [PATHS.JOB]: DECLARED.job,
  [PATHS.JOB_SPEC]: SAMPLES.SPEC,
  [PATHS.ADAPTER]: DECLARED.repository,
  [PATHS.GATEWAY]: DECLARED.gateway,
  [PATHS.PAYMENT_ADAPTER]: DECLARED.adapter,
};
