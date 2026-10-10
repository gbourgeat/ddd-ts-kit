import type { RuleDoc } from '../model/rule-doc.js';

export const LANGUAGE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'language/glossary-term': {
    why: 'The ubiquitous language is the contract between the domain experts and the code. A class named with a word nobody defined is either a concept the experts do not know, or a synonym that will split the vocabulary in two. Writing the term and its meaning first forces the conversation that the name needs.',
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
