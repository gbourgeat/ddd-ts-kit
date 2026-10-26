import { beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, read, tempDir, write } from '../helpers';
import { initFlags } from '../support/init-flags';
import { installAsPublished } from './install-as-published';
import { bin, runIn } from './run-in';
import { FAILED_COUNT } from './run-specs';
import { SLOW } from './stacks';

const MAPPER = 'src/platform/composition/platform-error-mapper.ts';
const SPEC = 'src/platform/composition/platform-error-mapper.spec.ts';

const MAPPED = 'UNAUTHENTICATED';

const SPEC_SOURCE = `import { ErrorMapper } from '@ddd-ts-kit/http';
import { createTestApplication } from '@ddd-ts-kit/di';
import { expect, it } from 'vitest';
import { platformErrorMapper } from '@/platform/composition/platform-error-mapper';
import { platformTestModule } from '@/platform/composition/platform-test.module';

it('maps a refusal through the test application as the platform does', () => {
  const app = createTestApplication({ modules: [platformTestModule] });

  expect(platformErrorMapper().statusOf('${MAPPED}')).toBe(401);
  expect(app.get(ErrorMapper).statusOf('${MAPPED}')).toBe(401);
});
`;

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a generated project whose platform maps a refusal to 401 in the
 * one file `init` writes for its error mapper; the test platform answers the same status, where it
 * once bound nothing and a route spec saw the default mapper.
 */
describe.runIf(SLOW)('the error mapper of a generated project', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('error-mapper');
    expect(cli(root, 'init', ...initFlags(DEFAULT_STACK)).code).toBe(0);
    installAsPublished(root);

    write(root, MAPPER, read(root, MAPPER).replace('createErrorMapper()', `createErrorMapper({ ${MAPPED}: 401 })`));

    write(root, SPEC, SPEC_SOURCE);
  }, 120_000);

  it('is the same in the test platform and in the platform of the application', () => {
    const specs = runIn(root, { command: bin('vitest'), args: ['run', SPEC] });

    expect(specs).toMatch(/Test Files\s+1 passed/);
    expect(specs).not.toMatch(FAILED_COUNT);
  }, 240_000);
});
