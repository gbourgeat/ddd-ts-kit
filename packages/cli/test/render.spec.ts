import { describe, expect, it } from 'vitest';
import { render } from '../src/render.js';
import { toName } from '../src/naming.js';
import { listTemplates, readTemplate } from '../src/templates.js';

describe('template renderer', () => {
  const context = { name: { ...toName('InvoiceLine') }, context: { kebab: 'billing' }, flags: { on: true, off: false } };

  it('replaces nested placeholders', () => {
    expect(render('{{name.pascal}} {{name.camel}} {{name.kebab}} {{name.constant}} {{context.kebab}}', context)).toBe(
      'InvoiceLine invoiceLine invoice-line INVOICE_LINE billing',
    );
  });

  it('keeps or drops conditional blocks', () => {
    expect(render('a{{#if flags.on}}b{{/if}}{{#if flags.off}}c{{/if}}{{#unless flags.off}}d{{/unless}}', context)).toBe('abd');
  });

  it('supports nested blocks and does not evaluate placeholders of a dropped block', () => {
    expect(render('{{#if flags.off}}{{missing.value}}{{#if flags.on}}x{{/if}}{{/if}}ok', context)).toBe('ok');
  });

  it('removes the line of a block tag standing alone', () => {
    expect(render('one\n{{#if flags.on}}\ntwo\n{{/if}}\nthree\n', context)).toBe('one\ntwo\nthree\n');
  });

  it('refuses an unknown placeholder', () => {
    expect(() => render('{{name.snake}}', context)).toThrow(/unknown placeholder "\{\{name.snake\}\}"/);
  });

  it('refuses a placeholder that survives rendering', () => {
    expect(() => render('{{name pascal}}', context)).toThrow(/leftover placeholder/);
  });

  it('refuses a condition that is not a known boolean', () => {
    expect(() => render('{{#if flags.typo}}x{{/if}}', context)).toThrow(/not a known boolean/);
    expect(() => render('{{#if name.pascal}}x{{/if}}', context)).toThrow(/not a known boolean/);
  });

  it('refuses unbalanced blocks', () => {
    expect(() => render('{{#if flags.on}}x', context)).toThrow(/never closed/);
    expect(() => render('x{{/if}}', context)).toThrow(/closes nothing/);
  });
});

describe('shipped templates', () => {
  const templates = listTemplates();
  // Built from code points so that this file does not contain the characters it forbids.
  const TYPOGRAPHIC_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

  it('exist for every kind', () => {
    const kinds = new Set(templates.map((template) => template.split('/')[0]));
    expect([...kinds].sort()).toEqual(
      ['acl', 'adr', 'architecture', 'gateway', 'policy', 'service', 'aggregate', 'builder', 'command', 'consumer', 'context', 'docs', 'domain-error', 'domain-event', 'domain-service', 'e2e', 'entity', 'event-handler', 'init', 'integration-event', 'pipeline', 'port', 'query', 'repository', 'route', 'value-object'].sort(),
    );
  });

  it('contain no typographic dash', () => {
    for (const template of templates) {
      expect(TYPOGRAPHIC_DASH.test(readTemplate(template)), template).toBe(false);
    }
  });
});
