import { it } from 'vitest';
import { expectCoexistence } from './support/coexistence';

it('holds in the other order too: the error reporter started before tracing leaves OpenTelemetry alone', async () => {
  await expectCoexistence(['sentry', 'tracing']);
});
