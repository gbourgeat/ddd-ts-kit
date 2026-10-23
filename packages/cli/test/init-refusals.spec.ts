import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';

describe('init, the form of the refusals', () => {
  it('names each refusal by default, and tells the agents how, the other forms as they were', () => {
    const named = initProject();
    const factories = initProject('--refusals', 'factories');
    const classes = initProject('--refusals', 'classes');
    const rules = (root: string, layer: string) => read(root, `.claude/rules/${layer}.md`);

    expect(jsonAt(readJson(named, 'ddd-ts-kit.config.json'), 'stack', 'refusals')).toBe('named');
    expect(rules(named, 'domain')).toContain('`throw InvoiceAlreadyIssued.forInvoice(this.id)`');
    expect(rules(named, 'domain')).toContain('`readonly code = BillingCodes.InvoiceAlreadyIssued;`');
    expect(rules(named, 'domain')).toContain('ddd-ts-kit generate error <context> <Refusal> <factory> --json');
    expect(rules(named, 'domain')).toContain('(`throw InvalidEmail.forAddress(raw)`)');
    expect(rules(named, 'domain')).not.toContain('ConceptError');
    expect(rules(named, 'presentation')).toContain('as the `codes.ts` of its context lists them');
    expect(rules(factories, 'domain')).toContain('`throw InvoiceError.alreadyIssued(this.id)`');
    expect(rules(factories, 'domain')).not.toContain('codes.ts');
    expect(rules(factories, 'presentation')).toContain('as their factories set them');

    expect(rules(classes, 'domain')).toContain(
      'generate aggregate|entity|value-object|vocabulary|domain-event|domain-error',
    );

    expect(rules(classes, 'domain')).not.toContain('DomainRefusal');

    // The type of the codes of a context is there for the code that takes any of them, which a new context has none of.
    expect(jsonAt(readJson(named, 'knip.json'), 'ignoreIssues')).toEqual({
      'src/contexts/*/domain/errors/codes.ts': ['types'],
    });

    expect(jsonAt(readJson(factories, 'knip.json'), 'ignoreIssues')).toBeUndefined();
  });
});
