import type { RuleDoc } from '../model/rule-doc.js';

export const LAYOUT_DOCS: Readonly<Record<string, RuleDoc>> = {
  'clean/no-hash-private': {
    why: 'A code base has one way to hide a member. `private` is checked by the compiler, reads the same on a field, a method and a constructor parameter, and leaves the member reachable by the tooling of a test. `#name` is a second spelling of the same intention, with its own rules, that cannot be mixed with constructor parameters. ESLint can rewrite it when the change is safe.',
    bad: `export class InMemoryInvoiceRepository {
  readonly #rows = new Map<string, Invoice>();

  #find(id: string): Invoice | undefined {
    return this.#rows.get(id);
  }
}`,
    good: `export class InMemoryInvoiceRepository {
  private readonly rows = new Map<string, Invoice>();

  private find(id: string): Invoice | undefined {
    return this.rows.get(id);
  }
}`,
  },
  'clean/blank-lines': {
    why: 'A function reads in steps: what it gathers, what it decides, what it answers. A blank line before `return` sets the outcome apart, and a block that starts and ends on its braces wastes no line. This checker holds the cheap part only: the `return` and the padded block. ESLint holds the blank lines between statements (after a group of declarations, around `if`, `for`, `try` and a multiline statement, between class members) and is authoritative, with an automatic fix; the formatter removes the padding of a block.',
    bad: `function total(lines: readonly Line[]): Money {

  const amounts = lines.map((line) => line.amount);
  return sum(amounts);
}`,
    good: `function total(lines: readonly Line[]): Money {
  const amounts = lines.map((line) => line.amount);

  return sum(amounts);
}`,
  },
  'clean/braces': {
    why: 'A branch or a loop written between braces, its body on its own lines, is visible at a glance, and a statement added to it later cannot silently fall outside it. Every `if`, `else`, `for`, `while` and `do` is written that way, `else` on the line of the closing brace. A ternary, an arrow function returning an expression and a one-line object literal are not judged. ESLint holds the braces on the syntax tree (`curly`) and adds them; the formatter puts the body on its own lines.',
    bad: `if (wrapped.has(repository)) return repository;

for (const step of steps) await step();

if (invoice.isPaid()) { return receipt; }`,
    good: `if (wrapped.has(repository)) {
  return repository;
}

for (const step of steps) {
  await step();
}

if (invoice.isPaid()) {
  return receipt;
}`,
  },
  'clean/one-export-per-file': {
    why: 'A file that exports one thing is named after it, found by its name and changed for one reason. A second exported class or function is a second responsibility hiding behind the first name. The companions that stay are the ones that are not a second thing: the types of its signature, its contract constants, a type sharing its name, and a small closed family (a type with its constructors, the accessors of one private state). An index file only re-exports: it says what a folder offers. Tests are not judged. This checker reads declarations as text, so the allowances are an approximation; ESLint is authoritative, and what neither can express is listed with its reason under "onePerFile.allow".',
    bad: `// application/ports/gateways.port.ts
export abstract class PaymentGateway {}
export abstract class TaxGateway {}
// domain/services/helpers.service.ts
export class InvoiceNumbering {}`,
    good: `// application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {}
// application/ports/tax-gateway.port.ts
export abstract class TaxGateway {}
// application/commands/issue-invoice/issue-invoice.result.ts
export interface IssueInvoiceResult { readonly invoiceId: string }`,
  },
  'clean/file-size': {
    why: 'Past a few hundred lines a file holds more than one responsibility: nobody reads it whole, and every change touches something unrelated. The limit is 350 physical lines, for sources and tests alike, and is not configurable. A long test file is split by behaviour, a long source by concept. Generated files (a path segment named generated, the <context>.declarations.ts and <context>.dependencies.ts at the root of a context) and declaration files are not judged.',
    bad: `// application/commands/issue-invoice/issue-invoice.handler.ts, 600 lines:
// the handler, its validation, its mapping and three helpers`,
    good: `// issue-invoice.handler.ts orchestrates, in 40 lines;
// the rules it applies live in the aggregate and in a domain service, each in its file`,
  },
};
