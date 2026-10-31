import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const COMMANDS = 'src/contexts/ordering/application/commands';

function todoOf(root: string, folder: string): string {
  return read(root, `${COMMANDS}/${folder}/${folder}.handler.ts`)
    .split('\n')
    .filter((line) => line.includes('TODO(domain)'))
    .join('\n');
}

describe.each([
  ['named', ['--refusals', 'named']],
  ['factories', ['--refusals', 'factories']],
  ['classes', ['--refusals', 'classes']],
])('the TODO(domain) of a generated command handler under %s refusals', (_style, flags) => {
  function orderProject(): string {
    const root = initProject('--context', 'ordering:core', '--audit', 'off', ...flags);

    const steps = [
      ['generate', 'aggregate', 'ordering', 'Order', '--term', 'Order=A purchase', '--term', 'Place=to create'],
      ['generate', 'aggregate', 'ordering', 'Order', '--term', 'Confirm=to confirm'],
      [
        'generate',
        'command',
        'ordering',
        'PlaceOrder',
        '--permission',
        'order.place',
        '--aggregate',
        'Order',
        '--creates',
      ],
      ['generate', 'command', 'ordering', 'ConfirmOrder', '--permission', 'order.confirm', '--aggregate', 'Order'],
    ];

    for (const step of steps) {
      const done = cli(root, ...step);

      expect(done.code, done.stderr).toBe(0);
    }

    return root;
  }

  it('asks a --creates handler only for what the flag left open', () => {
    const todo = todoOf(orderProject(), 'place-order');

    expect(todo).toContain('keep `create` and pass the facts of `command` as value objects');
    expect(todo).not.toContain('changes an existing one');
    expect(todo).not.toContain('findById');
  });

  it('does not describe the flag in the TODO of the handler that changes an aggregate', () => {
    const todo = todoOf(orderProject(), 'confirm-order');

    expect(todo).toContain('findById');
    expect(todo).not.toContain('--creates');
    expect(todo).not.toContain('gives birth');
  });
});
