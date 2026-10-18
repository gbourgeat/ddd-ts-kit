import { beforeAll, describe, expect, it } from 'vitest';
import { read, write } from './helpers.js';
import { failure, report } from './reports.js';
import { billingProject as project, generateError as generate } from './support/billing-error-project.js';

const ERRORS = 'src/contexts/billing/domain/errors';
const UNIT = 'src/contexts/billing/test/unit';

describe('generate error, in a project of one error class per concept, where its files are not what it expects', () => {
  let root: string;

  beforeAll(() => {
    root = project('error-cases', '--refusals', 'factories');
  });

  it('refuses to add a factory to a file that does not declare the error class of the concept, and leaves it', () => {
    write(root, `${ERRORS}/invoice.error.ts`, 'export class Invoice {}\n');

    expect(failure(generate(root, 'Invoice', 'alreadyIssued'))).toEqual({
      message: `${ERRORS}/invoice.error.ts does not declare the class InvoiceError.`,
      fix: 'Name the class after its file, or add the factory alreadyIssued by hand.',
    });

    expect(read(root, `${ERRORS}/invoice.error.ts`)).toBe('export class Invoice {}\n');
  });

  it('writes the factory, and says the case to add by hand to a spec without a describe block', () => {
    const spec = "import { it } from 'vitest';\n\nit.todo('refuses');\n";

    write(root, `${UNIT}/issue.error.spec.ts`, spec);

    const written = report(generate(root, 'Issue', 'tooLate'));

    expect(written.created).toEqual([`${ERRORS}/issue.error.ts`]);

    expect(written.notes).toContain(
      `${UNIT}/issue.error.spec.ts has no describe block: add the case of IssueError.tooLate by hand.`,
    );

    expect(read(root, `${UNIT}/issue.error.spec.ts`)).toBe(spec);
  });
});
