import { describe, expect, it } from 'vitest';
import { errorCodes } from '../src/check/errors/error-codes';
import { readCodeList } from '../src/check/errors/read-code-list';
import { NAMED_REFUSAL_FIXTURES } from '../src/check/fixtures/named-refusal-fixtures';
import { runFixture } from '../src/check/fixtures/run-fixture';
import { scan } from '../src/check/scan/scan';

const SLOT_TAKEN = `import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from './codes.js';

export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal('THE_SLOT_IS_HELD', { calendarId });
  }
}
`;

/** What `errors/code-listed` says on the fixture of that name, message by message. */
function said(name: string): string[] {
  const fixture = NAMED_REFUSAL_FIXTURES.find((candidate) => candidate.name === name);

  if (fixture === undefined) {
    throw new Error(`No fixture named "${name}".`);
  }

  return runFixture(fixture)
    .violations.filter((violation) => violation.ruleId === fixture.ruleId)
    .map((violation) => violation.message);
}

describe('reading the code list of a context', () => {
  it('reads each entry with its code and its line, and whether the list is declared as const', () => {
    const list = readCodeList(
      scan(
        "export const SchedulingCodes = {\n  SlotTaken: 'SLOT_TAKEN',\n  ...Others,\n  AppointmentEnded: ENDED,\n} as const;\n",
      ),
      'SchedulingCodes',
    );

    expect(list).toEqual({
      name: 'SchedulingCodes',
      line: 1,
      constant: true,
      entries: [
        { key: 'SlotTaken', code: 'SLOT_TAKEN', line: 2 },
        { key: 'AppointmentEnded', code: undefined, line: 4 },
      ],
    });
  });

  it('finds no list under another name, and tells a list that is not as const', () => {
    const source = scan("export const Codes: Record<string, string> = { SlotTaken: 'SLOT_TAKEN' };\n");

    expect(readCodeList(source, 'SchedulingCodes')).toBeUndefined();
    expect(readCodeList(source, 'Codes')?.constant).toBe(false);
  });

  it('never reads the message a factory of a refusal class gives refusal(..) as a code', () => {
    expect(errorCodes(scan(SLOT_TAKEN))).toEqual([]);
  });
});

describe('what errors/code-listed says under "stack.refusals": "named"', () => {
  it('names the class, the code it writes and the entry it should read', () => {
    expect(said('a refusal class that writes its code as a string literal')).toEqual([
      "InvoiceAlreadyIssued sets its code to `'INVOICE_ALREADY_ISSUED'`, not to BillingCodes.InvoiceAlreadyIssued.",
    ]);

    expect(said('a refusal class that reads the code of another entry')).toEqual([
      'InvoiceAlreadyIssued sets its code to `BillingCodes.UnknownInvoice`, not to BillingCodes.InvoiceAlreadyIssued.',
    ]);

    expect(said('a refusal class without a code')).toEqual([
      'InvoiceAlreadyIssued declares no code: a refusal reads its code from BillingCodes, under its own name.',
    ]);
  });

  it('says what the list lacks, once per class', () => {
    expect(said('a refusal class whose name the list does not hold')).toEqual([
      'BillingCodes has no entry InvoiceAlreadySent: the code of the refusal is not listed.',
    ]);

    expect(said('refusal classes in a context without domain/errors/codes.ts')).toEqual([
      'InvoiceAlreadyIssued reads BillingCodes.InvoiceAlreadyIssued, but the context "billing" has no domain/errors/codes.ts.',
      'UnknownInvoice reads BillingCodes.UnknownInvoice, but the context "billing" has no domain/errors/codes.ts.',
    ]);
  });

  it('says what is wrong with the list itself', () => {
    expect(said('an entry of the list that names no refusal class')).toEqual([
      'BillingCodes lists UnknownInvoice, which no refusal class of the domain/errors/ of "billing" is.',
    ]);

    expect(said('a code of the list not in constant case')).toEqual([
      'The code of InvoiceAlreadyIssued, "invoice-already-issued", is not in constant case.',
    ]);

    expect(said('a code of the list that is not a string literal')).toEqual([
      'The code of InvoiceAlreadyIssued is not a string literal.',
    ]);

    expect(said('a code list not declared as const')).toEqual([
      'BillingCodes is not declared `as const`: every code is typed string, and a refusal loses the type of its own code.',
    ]);

    expect(said('a codes.ts that declares no list named after its context')).toEqual([
      'domain/errors/codes.ts of "billing" declares no BillingCodes.',
    ]);
  });
});
