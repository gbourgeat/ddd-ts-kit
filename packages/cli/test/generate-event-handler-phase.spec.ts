import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, scaffoldEverything, tempDir } from './helpers.js';

const UNIT = 'src/contexts/billing/test/unit';

let root: string;

beforeAll(() => {
  root = tempDir('event-handler-phase');
  scaffoldEverything(root);
});

describe('generate event-handler and the phase of the reaction', () => {
  it('writes a spec that runs the reaction before the commit of a unit of work, by default', () => {
    const spec = read(root, `${UNIT}/invoice-issued.event-handler.spec.ts`);

    expect(spec).toContain(
      "it('reacts at the end of the unit of work, before the commit, without failing', async () => {",
    );

    expect(spec).toContain("domainEvents.on('billing.invoice.issued', asSubscribed, { phase: 'before-commit' });");
    expect(spec).toContain("expect(reactedAt).toEqual(['before-commit']);");
  });

  it('writes a spec that runs the reaction once the unit of work has committed, with --phase after-commit', () => {
    const spec = read(root, `${UNIT}/invoice-marked-as-paid.event-handler.spec.ts`);

    expect(spec).toContain("it('reacts once the unit of work has committed, without failing', async () => {");

    expect(spec).toContain(
      "domainEvents.on('billing.invoice.marked-as-paid', asSubscribed, { phase: 'after-commit' });",
    );

    expect(spec).toContain("expect(reactedAt).toEqual(['after-commit']);");
    expect(spec).toContain('expect(domainEvents.afterCommitFailures).toEqual([]);');
  });

  it('refuses a phase it does not know, and says which exist', () => {
    const result = cli(root, 'generate', 'event-handler', 'billing', 'Invoice', 'Cancelled', '--phase', 'later');

    expect(result.code).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Unknown phase "later".');
    expect(`${result.stdout}${result.stderr}`).toContain('--phase after-commit');
  });
});
