import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { jsonAt } from './support/json-at.js';

const HANDLER_SPEC = 'src/contexts/billing/test/unit/issue-invoice.handler.spec.ts';

describe('todo', () => {
  let root: string;

  beforeAll(() => {
    root = initProject('--context', 'billing:core', '--context', 'shipping:supporting');

    cli(
      root,
      'generate',
      'command',
      'billing',
      'IssueInvoice',
      '--public',
      '--term',
      'Invoice=A request for payment',
      '--term',
      'Issue=To make an invoice final',
    );

    cli(root, 'generate', 'route', 'billing', 'IssueInvoice', '--method', 'POST', '--path', '/invoices');
    cli(root, 'generate', 'e2e', 'billing', 'IssueInvoice');
  });

  it('lists the TODO(domain) of a context as file:line with their text', () => {
    const todo = cli(root, 'todo', 'billing');

    expect(todo.code).toBe(0);
    expect(todo.stdout).toMatch(/^src\/contexts\/billing\/CONTEXT\.md:\d+ {2}TODO\(domain\) {2}say in two sentences/m);
    expect(todo.stdout).not.toContain('src/contexts/shipping/');
    expect(todo.stdout).not.toContain('src/platform/');
  });

  it('lists the it.todo entries with their title, and the end-to-end spec of a use case with its context', () => {
    const title = /\bit\.todo\('([^']+)'/.exec(read(root, HANDLER_SPEC))?.[1] ?? 'no it.todo in the generated spec';
    const remaining = jsonAt(cli(root, 'todo', 'billing', '--json').json(), 'remaining');

    expect(remaining).toContainEqual(
      expect.objectContaining({ kind: 'test', context: 'billing', file: HANDLER_SPEC, text: title }),
    );

    expect(remaining).toContainEqual(
      expect.objectContaining({ context: 'billing', file: 'test/e2e/issue-invoice.e2e.spec.ts' }),
    );
  });

  it('lists TODO(platform) too, and without a context the whole project', () => {
    write(root, 'src/platform/notes.ts', '// TODO(platform): choose the mail provider.\nexport const NOTES = 1;\n');

    const all = cli(root, 'todo', '--json').json();

    expect(jsonAt(all, 'remaining')).toContainEqual({
      kind: 'platform',
      context: '',
      file: 'src/platform/notes.ts',
      line: 1,
      text: 'choose the mail provider.',
    });

    expect(jsonAt(all, 'remaining')).toContainEqual(
      expect.objectContaining({ context: 'shipping', file: 'src/contexts/shipping/CONTEXT.md' }),
    );

    expect(jsonAt(all, 'remaining')).toHaveLength(Number(jsonAt(all, 'count')));
  });

  it('lists the TODO(review) a review left where its remark belongs, in text and as JSON', () => {
    const handler = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';
    const lines = read(root, handler).split('\n');

    write(
      root,
      handler,
      [...lines.slice(0, 1), '// TODO(review): name the total after the glossary.', ...lines.slice(1)].join('\n'),
    );

    expect(cli(root, 'todo', 'billing').stdout).toContain(
      `${handler}:2  TODO(review)  name the total after the glossary.`,
    );

    expect(jsonAt(cli(root, 'todo', 'billing', '--json').json(), 'remaining')).toContainEqual({
      kind: 'review',
      context: 'billing',
      file: handler,
      line: 2,
      text: 'name the total after the glossary.',
    });

    expect(cli(root, 'todo', 'shipping').stdout).not.toContain('TODO(review)');
  });

  it('says so when nothing is left, and refuses an unknown context', () => {
    write(root, 'src/contexts/shipping/CONTEXT.md', '# Shipping\n');

    expect(cli(root, 'todo', 'shipping').stdout).toBe('Nothing is left to fill.');
    expect(cli(root, 'todo', 'shipping', '--json').json()).toEqual({ count: 0, remaining: [] });
    expect(cli(root, 'todo', 'catalog').code).toBe(2);
    expect(cli(root, 'todo', 'catalog').stderr).toContain('Unknown context "catalog".');
  });
});
