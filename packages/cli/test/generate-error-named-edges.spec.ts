import { beforeAll, describe, expect, it } from 'vitest';
import { exists, read, write } from './helpers';
import { failure, report } from './reports';
import { billingProject as project, generateError as generate } from './support/billing-error-project';

const ERRORS = 'src/contexts/billing/domain/errors';
const UNIT = 'src/contexts/billing/test/unit';
const ISSUED = `${ERRORS}/invoice-already-issued.error.ts`;
const AGGREGATE = 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts';
const LATE_SPEC = `${UNIT}/invoice-late.error.spec.ts`;

describe('generate error, in a project of one class per refusal, where its files are not what it expects', () => {
  let root: string;

  beforeAll(() => {
    root = project('error-named-cases');
    expect(generate(root, 'InvoiceAlreadyIssued', 'forInvoice').code).toBe(0);
  });

  it('refuses to add a factory to a file that does not declare the refusal class, and leaves it', () => {
    write(root, ISSUED, 'export class Invoice {}\n');

    expect(failure(generate(root, 'InvoiceAlreadyIssued', 'forCustomer'))).toEqual({
      message: `${ISSUED} does not declare the class InvoiceAlreadyIssued.`,
      fix: 'Name the class after its file, or add the factory forCustomer by hand.',
    });

    expect(read(root, ISSUED)).toBe('export class Invoice {}\n');
  });

  it('refuses a refusal named after another class of the context, and writes nothing', () => {
    write(root, AGGREGATE, 'export class Invoice extends AggregateRoot {}\n');

    expect(failure(generate(root, 'Invoice', 'forOverdue'))).toEqual({
      message: `"Invoice" names a class of the context already, in ${AGGREGATE}.`,
      fix: 'Name the refusal after what is refused, in the words of the glossary (for example InvoiceAlreadyIssued): a refusal class never takes the name of another class of its context.',
    });

    expect(exists(root, `${ERRORS}/invoice.error.ts`)).toBe(false);
  });

  it('writes the factory, and says the case to add by hand to a spec without a describe block', () => {
    const spec = "import { it } from 'vitest';\n\nit.todo('refuses');\n";

    write(root, LATE_SPEC, spec);

    const written = report(generate(root, 'InvoiceLate', 'forInvoice', '--term', 'Late=Past its due date'));

    expect(written.created).toContain(`${ERRORS}/invoice-late.error.ts`);

    expect(written.notes).toContain(
      `${LATE_SPEC} has no describe block: add the case of InvoiceLate.forInvoice by hand.`,
    );

    expect(read(root, LATE_SPEC)).toBe(spec);
  });
});
