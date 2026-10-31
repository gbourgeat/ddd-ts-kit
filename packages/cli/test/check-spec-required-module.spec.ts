import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';

const SERVICE = 'src/contexts/billing/invoicing/domain/services/tax-rate.service.ts';
const SERVICE_CODE = 'export class TaxRateService {\n  rate(): number {\n    return 20;\n  }\n}\n';

function fixOf(root: string): string {
  const report = checkJsonOf(cli(root, 'check', '--rule', 'test/spec-required', '--json'));

  return report.violations.map((violation) => violation.fix).join('\n');
}

describe('the fix of test/spec-required', () => {
  it('names test/unit/<module>/ for a file of a module of the model', () => {
    const root = initProject('--context', 'billing:core', '--audit', 'off');

    expect(
      cli(root, 'generate', 'module', 'billing', 'invoicing', '--term', 'Invoicing=part', '--purpose', 'p').code,
    ).toBe(0);

    write(root, SERVICE, SERVICE_CODE);

    expect(fixOf(root)).toContain('src/contexts/billing/test/unit/invoicing/tax-rate.service.spec.ts');
  });

  it('names test/unit/ for a file outside every module', () => {
    const root = initProject('--context', 'billing:core', '--audit', 'off');

    write(root, 'src/contexts/billing/domain/services/tax-rate.service.ts', SERVICE_CODE);

    expect(fixOf(root)).toContain('src/contexts/billing/test/unit/tax-rate.service.spec.ts');
  });
});
