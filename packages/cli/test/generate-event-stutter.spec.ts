import { describe, expect, it } from 'vitest';
import { cli, exists } from './helpers';
import { initProject } from './support/init-project';

function orderProject(): string {
  const root = initProject('--context', 'ordering:core', '--audit', 'off');

  const born = cli(root, 'generate', 'aggregate', 'ordering', 'Order', '--term', 'Order=A purchase');

  expect(born.code).toBe(0);

  return root;
}

describe('the fact of a domain event that starts with its aggregate', () => {
  it('is refused with the form to use, and nothing is written', () => {
    const root = orderProject();

    const refused = cli(
      root,
      'generate',
      'domain-event',
      'ordering',
      'Order',
      'Order Confirmed',
      '--term',
      'Confirm=To confirm',
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('"OrderConfirmed" starts with the aggregate Order');
    expect(refused.stderr).toContain('Give the fact alone, "Confirmed"');
    expect(exists(root, 'src/contexts/ordering/domain/events/order-order-confirmed.event.ts')).toBe(false);
  });

  it('is let through by --allow-name', () => {
    const root = orderProject();

    const allowed = cli(
      root,
      'generate',
      'domain-event',
      'ordering',
      'Order',
      'Order Confirmed',
      '--term',
      'Confirm=To confirm',
      '--allow-name',
    );

    expect(allowed.code).toBe(0);
  });

  it('is accepted when the fact is given alone, or only resembles the aggregate', () => {
    const root = orderProject();

    const alone = cli(
      root,
      'generate',
      'domain-event',
      'ordering',
      'Order',
      'Confirmed',
      '--term',
      'Confirm=To confirm',
    );

    expect(alone.code).toBe(0);
    expect(exists(root, 'src/contexts/ordering/domain/events/order-confirmed.event.ts')).toBe(true);
  });
});

describe('--birth on an aggregate that already exists', () => {
  it('writes no event, and says that --birth applies to a new aggregate', () => {
    const root = orderProject();

    const again = cli(
      root,
      'generate',
      'aggregate',
      'ordering',
      'Order',
      '--birth',
      'Rebirthed',
      '--term',
      'Rebirth=Again',
    );

    expect(again.code).toBe(0);
    expect(again.stdout).toContain('--birth Rebirthed applies to a new aggregate');
    expect(exists(root, 'src/contexts/ordering/domain/events/order-rebirthed.event.ts')).toBe(false);
  });
});
