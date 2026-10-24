**English** · [Français](test-title-states-a-rule.fr.md)

# ddd-ts-kit/test-title-states-a-rule

Architecture id: `test/title-states-a-rule` (added by this plugin). Default severity: `warn` in `recommended` (an error from 0.90.0: `ddd-ts-kit lint` shows its warnings without failing on them until then), `error` in `strict`.

Applies to: every test file of the project (`*.spec.ts`, `*.test.ts`, the `test/` of a context).

## Why

The titles of a spec are the only part of it the whole team reads: the report of a failed run, the list `npm test` prints, the review. Written as rules, in the words of the business, they are the specification of the unit, and a new test is written by stating one more rule. Written as `should ...`, `test ...` or after a method, they say that something is tested without saying what is true, and the reader opens the body to find out.

## Reported

On an `it` or a `test`, after the rows and the criterion the title cites (`#US5.02 AC1 ...`, `AC1 ...`, `#FIX-412 ...`):

- a word that says the test is a test: `should`, `test`, `tests`, `testing`, `works`, `correctly`, `properly`, `successfully`, `as expected`, `make sure`, `ensures that`, `verifies that`, `checks that`
- a name of code: a call (`execute()`, `pay(at)`), a first word in camelCase (`issueInvoice`)
- a first word that does not start with a lower-case letter (`Refuses`, `The invoice`), unless it is the placeholder of a table-driven title (`%s`, `$kind`)
- an empty title

On a `describe`: a title named after the tests (`tests`, `spec`, `suite`, `should`, a `Spec` or `Test` suffix) or empty.

Incorrect:

```ts
describe('Invoice tests', () => {
  it('should refuse a second payment', () => { ... });
  it('execute() saves the invoice', () => { ... });
  it('Pays the invoice correctly', () => { ... });
});
```

Correct:

```ts
describe('Invoice', () => {
  it('refuses to pay an invoice twice', () => { ... });
  it('saves the invoice and answers its identifier', () => { ... });
  it('#US5.02 AC1 a customer places an order', pending(async () => { ... }));
  it.each(kinds)('%s announces an appointment to come', (kind) => { ... });
});
```

## Details

A title held in a variable is not judged. A template title is read with its expressions as placeholders: `` `answers ${status} to a caller` `` passes, and so does one that starts with an expression. `describe` takes the unit under test, the aggregate (`Invoice`), the use case (`Issue invoice`), the route (`POST /invoices`), a fact (`When scheduling publishes scheduling.appointment.booked`): a noun, in any case.

## Options

None.

`rules."test/title-states-a-rule"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line test/title-states-a-rule -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The rule reads the form of a title, not its meaning: `records the payment` passes whether or not the test records a payment. The review reads the body.
- A verb is recognised by its case, not by a dictionary: `the invoice is paid` passes.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because reading a test needs a syntax tree.
