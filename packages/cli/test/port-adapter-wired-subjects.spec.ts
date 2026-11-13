import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../src/check/fixtures/fixtures';
import { runFixture } from '../src/check/fixtures/run-fixture';

const RULE = 'declarations/port-adapter-wired';

describe('declarations/port-adapter-wired: the files its finding is repaired in', () => {
  it('names the module files of the context and the composition files that import it, not every file of the platform', () => {
    const unwired = FIXTURES.find(
      (fixture) =>
        fixture.ruleId === RULE && fixture.name === 'explicit style: an adapter the module file does not bind',
    );

    const wiring = 'src/platform/composition/wire-billing.ts';

    const { violations } = runFixture({
      ruleId: RULE,
      name: 'the subjects of an unwired adapter',
      expect: 'pass',
      files: {
        ...unwired?.files,
        [wiring]:
          "import { billingModule } from '@/contexts/billing/billing.module.js';\n\nexport const wired = [billingModule];\n",
        'src/platform/auth/roles.ts': 'export const ROLES = [];\n',
        'src/main.ts': "import { ROLES } from '@/platform/auth/roles.js';\n\nexport const roles = ROLES;\n",
      },
    });

    const [finding] = violations.filter((violation) => violation.ruleId === RULE);

    expect(finding).toBeDefined();
    expect(finding?.subjects).toEqual(expect.arrayContaining([wiring]));
    expect(finding?.subjects).not.toContain('src/platform/auth/roles.ts');
    expect(finding?.subjects).not.toContain('src/main.ts');
  });
});
