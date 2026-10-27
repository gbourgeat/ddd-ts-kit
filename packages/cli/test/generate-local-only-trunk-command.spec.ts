import { beforeAll, describe, expect, it } from 'vitest';
import { cli, scaffoldEverything, tempDir } from './helpers';

let root: string;

beforeAll(() => {
  root = tempDir('local-only-trunk-command');
  scaffoldEverything(root, undefined);
});

describe('generate --local-only, the refusal of a kind the conductor owns', () => {
  it('names the exact command of the conductor on the trunk when a job is refused', () => {
    const refused = cli(
      root,
      'generate',
      'job',
      'billing',
      'CheckRegistration',
      '--every',
      '1h',
      '--command',
      'CancelInvoice',
      '--allow-name',
      '--local-only',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('A job of a row is a step of the conductor, before the row of the worker');

    expect(refused.stderr).toContain(
      'on the trunk, run `ddd-ts-kit generate job billing CheckRegistration --every 1h --command CancelInvoice --allow-name`',
    );

    expect(refused.stderr).not.toContain('--allow-name --local-only');
  });

  it('names the exact command of the conductor on the trunk when an integration event is refused, quoting a term', () => {
    cli(root, 'generate', 'aggregate', 'shipping', 'Parcel');
    cli(root, 'generate', 'domain-event', 'shipping', 'Parcel', 'Shipped');

    const refused = cli(
      root,
      'generate',
      'integration-event',
      'shipping',
      'Parcel',
      'Shipped',
      '--term',
      'Carrier=who hands it over',
      '--local-only',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('An integration-event of a row is a step of the conductor');

    expect(refused.stderr).toContain(
      'ddd-ts-kit generate integration-event shipping Parcel Shipped --term "Carrier=who hands it over"`',
    );
  });
});
