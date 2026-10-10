import { it } from 'vitest';
import { expectCoexistence } from './support/coexistence.js';

it('an error of a traced request leads to its trace, and the trace is exported once, by the kit: tracing started first', async () => {
  await expectCoexistence(['tracing', 'sentry']);
});
