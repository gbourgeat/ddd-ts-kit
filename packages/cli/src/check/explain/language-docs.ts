import type { RuleDoc } from '../model/rule-doc';

export const LANGUAGE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'language/glossary-term': {
    why: 'The ubiquitous language is the contract between the domain experts and the code. A class named with a word nobody defined is either a concept the experts do not know, or a synonym that will split the vocabulary in two. Writing the term and its meaning first forces the conversation that the name needs. Under "stack.refusals": "factories" or "named" the classes of domain/errors/ are judged too: `AppointmentError` names `Appointment`, `SlotTaken` names `Slot` and `Take`; a refusal class may also use the qualifiers of a refusal, invalid, unknown, already, too, no, missing and required (`BookingTooLate`, `InvalidAppointment`), and <context>.codes.ts, which holds no class, is not judged.',
    bad: `// CONTEXT.md glossary: Invoice, Issue
export class BillDispatcher {}`,
    good: `// CONTEXT.md glossary: Invoice, Issue
export class IssueInvoiceCommand {}`,
  },
  'language/no-technical-name': {
    why: 'Manager, Helper, Data or Impl say how a class is built, not what it means. In the domain such a name marks a concept that was not discussed: the behaviour ends up in a bag that keeps growing. A domain expert never says "invoice manager".',
    bad: `export class InvoiceManager {}`,
    good: `export class InvoiceNumbering {}`,
  },
  'language/declared-vocabulary': {
    why: 'A status, a kind, a role or a permission is a word of the language whose values are a closed list. Spelled again as a string wherever it is compared, granted or stored, each copy can drift: a typo compiles, a renamed value leaves its old spelling behind, and nothing completes it in the editor. Declared once, as an object `as const` and the union type of its name (a permission set for permissions), it is read by its key, completed by the editor, and a parameter typed with it accepts nothing else. The value stays the same string on the wire and in the database. A quoted key counts, and is written as a computed key, `[AppointmentStatus.NoShow]: ..`. Tests and published languages are not judged: a test sends the values a client sends, and a published language names the values of its contract itself; nor is the relationship schema of the access model, which declares its relations. In the persistence of a context, the name of a column, a table or a schema is a word of the storage that may spell a value by chance: the first argument of a call (`text("note")`) and the value of `name`, `tableName` or `schema` are not judged; a stored value, the argument of `.default(..)` or a value compared in a query, is. A word of another language that spells a value of the context does not belong to the context, and is not judged outside `domain/` when its type says so: a key of a table typed `Record<T, ..>`, a value of one typed `Record<.., T>` or a literal written `"x" satisfies T`, `T` being one type imported from a published language, imported as a type from a package, or imported from or declared in `infrastructure/anti-corruption/` or `infrastructure/external/`, so that the compiler holds its spelling. Where: the vocabulary of a context in that context only (the same word may mean something else next door), one of the platform (the roles) in the platform and in the route groups `*.routes.ts`, a permission id and a vocabulary of the shared kernel everywhere. What is read as a vocabulary: every entry a key and a string literal, comments, either quote and `as const satisfies ..` allowed; a number, a spread or a computed entry leaves the object unread, and so does a union type written otherwise than `(typeof X)[keyof typeof X]`. The rule holds under "stack.literals": "named", which `init` writes; a config that does not say keeps the free literals of 0.5.',
    bad: `// domain/vocabularies/appointment-status.vocabulary.ts declares AppointmentStatus
if (appointment.status === 'no-show') {
  grants.push('billing:invoice.issue');
}`,
    good: `if (appointment.status === AppointmentStatus.NoShow) {
  grants.push(billingPermissions['invoice.issue']);
}`,
  },
  'purity/no-system-clock': {
    why: 'Code that reads the clock gives a different answer every time it runs, so its tests are either flaky or need a mocked module. Passing the instant in, from the Clock port, makes every rule about time testable with a fixed date and replayable in production.',
    bad: `isOverdue(): boolean { return this.dueDate < new Date(); }`,
    good: `isOverdue(now: Date): boolean { return this.dueDate < now; }`,
  },
  'purity/no-ambient-randomness': {
    why: 'An identifier drawn inside the domain cannot be predicted by a test nor chosen by the caller (idempotent retries, imports of existing data). The IdGenerator port keeps the choice of the scheme in the composition root and gives tests readable, sequential identifiers.',
    bad: `static create(): Invoice { return new Invoice(crypto.randomUUID()); }`,
    good: `static create(id: string): Invoice { return new Invoice(id); }`,
  },
  'purity/no-environment': {
    why: 'Reading the environment, logging to the console or touching the network from the domain or a handler hides a dependency that no constructor declares. The class then needs the real world, or a mocked module, to be tested. Every such access is a port with an adapter.',
    bad: `if (process.env.FEATURE_X) console.log('issuing', invoice);`,
    good: `constructor(private readonly features: FeatureFlags) {}`,
  },
};
