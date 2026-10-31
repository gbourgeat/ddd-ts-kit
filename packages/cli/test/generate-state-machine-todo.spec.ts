import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

describe('the TODO(domain) of a generated state machine spec', () => {
  const SPEC = 'src/contexts/ordering/test/unit/order.state-machine.spec.ts';

  function machineProject(...flags: string[]): string {
    const root = initProject('--context', 'ordering:core', '--audit', 'off', ...flags);

    const steps = [
      ['generate', 'aggregate', 'ordering', 'Order', '--term', 'Order=A purchase', '--term', 'Confirm=to confirm'],
      [
        'generate',
        'state-machine',
        'ordering',
        'Order',
        '--value',
        'draft',
        '--value',
        'placed',
        '--transition',
        'confirm:draft>placed',
      ],
    ];

    for (const step of steps) {
      const done = cli(root, ...step);

      expect(done.code, done.stderr).toBe(0);
    }

    return root;
  }

  it('names OrderError where the style produces it', () => {
    expect(read(machineProject('--refusals', 'factories'), SPEC)).toContain('names a refusal of OrderError');
  });

  it('does not name a class the named style does not produce', () => {
    const spec = read(machineProject('--refusals', 'named'), SPEC);

    expect(spec).not.toContain('OrderError');
    expect(spec).toContain('generate error ordering <Refusal> <factory>');
  });
});
