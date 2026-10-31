import type { RuleDoc } from '../model/rule-doc';

/**
 * The rules another tool decides (the ESLint plugin, the formatter), explained as the rules of
 * the checker are: the reason, written as `docs/ARCHITECTURE.md` and the page of the rule say it,
 * and one example each way.
 */
export const DELEGATED_DOCS: Readonly<Record<string, RuleDoc>> = {
  'domain/aggregate-encapsulation': {
    why: 'An aggregate guards its invariants. A public constructor lets anyone build an invalid one, a public mutable property or a setter lets anyone change it without the rule that should have run.',
    bad: `export class Invoice {
  constructor(public status: string) {}
  setStatus(status: string): void {
    this.status = status;
  }
}`,
    good: `export class Invoice extends AggregateRoot<string> {
  private constructor(id: string, private state: InvoiceState) {
    super(id);
  }
  static create(id: string, now: Date): Invoice {
    return new Invoice(id, { createdAt: now });
  }
  issue(at: Date): void {
    this.state = { ...this.state, issuedAt: at };
    this.record(new InvoiceIssued(this.id, at));
  }
}`,
  },
  'domain/value-object-immutability': {
    why: 'A value object is its value. If it can change, two holders of the same instance disagree about what they hold, and equality by value stops meaning anything.',
    bad: `export class Amount {
  constructor(private cents: number) {}
  add(other: Amount): void {
    this.cents += other.cents;
  }
}`,
    good: `export class Amount extends ValueObject<AmountProps> {
  add(other: Amount): Amount {
    return new Amount({ cents: this.props.cents + other.props.cents });
  }
}`,
  },
  'domain/no-generic-error': {
    why: 'An expected business failure has a name and a stable code that presentation maps to a status in one place. `new Error("...")` gives the caller a sentence to parse. The same holds for every error of the language, `TypeError`, `RangeError` and the others, thrown directly or through a `const`: none of them says what was refused, nor carries a code.',
    bad: `throw new Error('Invoice already issued');
const failure = new TypeError('Invoice already issued');
throw failure;`,
    good: `// "stack.refusals": "named", which init writes
throw InvoiceAlreadyIssued.forInvoice(this.id);
// "stack.refusals": "factories"
throw InvoiceError.alreadyIssued(this.id);`,
  },
  'errors/through-factory': {
    why: 'The code that refuses reads as a sentence: `throw SlotTaken.forCalendar(calendar.id, slot.startsAt)` under `named`, where each refusal is a class of its own, and `throw AppointmentError.slotTaken(calendar.id, slot.startsAt)` under `factories`, where the refusals of one concept live in one class. The factory writes the code, the message and the facts once. A `new` is a refusal whose code and message are whatever the caller wrote.',
    bad: `import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw new SlotTaken(\`The slot at \${slot.startsAt.toISOString()} is held.\`);`,
    good: `import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';

throw SlotTaken.forCalendar(calendar.id, slot.startsAt);`,
  },
  'errors/constructor-not-public': {
    why: 'A public constructor lets any caller build a refusal with a code and a message of its own. `DomainRefusal` (the base of a refusal under `named`) and `ConceptError` (the base of a concept class under `factories`) of `@ddd-ts-kit/kernel` have a protected constructor, and a class that extends one declares none: a refusal then exists only through a static factory.',
    bad: `export class SlotTakenError extends DomainError {
  readonly code = 'SLOT_TAKEN';

  constructor(calendarId: string) {
    super(\`The slot on calendar \${calendarId} is already held.\`);
  }
}`,
    good: `export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal(\`The slot on calendar \${calendarId} is already held.\`, { calendarId });
  }
}`,
  },
  'errors/factory-name': {
    why: "The factory is read by the developer who refuses, the code by the client, the mapper, the audit trail and the tests. They must meet the same words, and those words are the business's. Under `named`, the class says what is refused and the factory what the refusal is about: `SlotTaken.forCalendar`, never `SlotTakenError.create`. Under `factories`, the factory says what is refused and the code repeats it: `slotTaken` and `SLOT_TAKEN`, never `create` and `BOOKING_FAILED`.",
    bad: `export class SlotTakenError extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTakenError;

  static slotTaken(calendarId: string) {
    return SlotTakenError.refusal('The slot is already held.', { calendarId });
  }
}`,
    good: `export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string) {
    return SlotTaken.refusal('The slot is already held.', { calendarId });
  }
}`,
  },
  'clean/no-magic-number': {
    why: "`hours * 60`, `limit = 100`, `padStart(2, '0')`: a number in the middle of the model says neither what it is nor who decided it. The second copy of it drifts from the first, and a rule of the business (a booking window, a reminder delay, a page limit) hides in an expression. Named once, it reads as the language: `MINUTES_PER_HOUR`, `LONGEST_ADDRESS`, `BookingWindow.standard()`.",
    bad: `function minuteOf(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}`,
    good: `const MINUTES_PER_HOUR = 60;

function minuteOf(hours: number, minutes: number): number {
  return hours * MINUTES_PER_HOUR + minutes;
}`,
  },
  'clean/formatted': {
    why: 'One way to lay out a file leaves nothing to discuss in a review and nothing to decide while writing: a line is at most 120 columns wide, and a diff shows what changed, never how somebody likes their line breaks. Biome lays out every TypeScript, JavaScript and JSON file with the `biome.json` of the project, and `npm run format` settles what `npm run format:check` reports.',
    bad: `export const total=(lines:readonly Line[])=>lines.reduce((sum,line)=>sum+line.amount,0)`,
    good: `// as npm run format writes it
export const total = (lines: readonly Line[]) => lines.reduce((sum, line) => sum + line.amount, 0);`,
  },
  'application/handler-shape': {
    why: 'A handler is one use case: one class, called by the bus through `execute`. A second public method is a second use case hiding in the first, or a business decision that belongs to the domain.',
    bad: `export class IssueInvoiceHandler {
  async handle(command: IssueInvoiceCommand): Promise<string> {}
  computeTotal(): number {}
}`,
    good: `export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  async execute(command: IssueInvoiceCommand): Promise<string> {}
  private total(): number {}
}`,
  },
  'application/command-query-separation': {
    why: 'A query answers and never changes state: it can then be retried, cached and run on a replica. A query that saves is a command with a return value.',
    bad: `export class SearchInvoicesHandler {
  async execute(query: SearchInvoicesQuery): Promise<SearchInvoicesResult> {
    await this.audit.save(query);
    return this.reader.read(query);
  }
}`,
    good: `export class SearchInvoicesHandler {
  async execute(query: SearchInvoicesQuery): Promise<SearchInvoicesResult> {
    return this.reader.read(query);
  }
}`,
  },
  'presentation/controller-shape': {
    why: 'A controller is one route: one class, called by the pipeline through `handle`. The class is found by the name of its file, read in one sitting, and its declaration is the single statement of the route. A second public method is a second route hiding in the first, or a translation that belongs to a request mapper or a serializer.',
    bad: `@Controller({ group: InvoicesRoutes, method: 'POST', path: '/', summary: 'Issue invoice', response: { status: 201, body: accepted } })
export class IssueInvoiceController {
  async execute(request: HttpRequest): Promise<IssueInvoiceAccepted> {}
  totalOf(body: IssueInvoiceBody): number {}
}`,
    good: `@Controller({ group: InvoicesRoutes, method: 'POST', path: '/', summary: 'Issue invoice', body, response: { status: 201, body: accepted } })
export class IssueInvoiceController {
  constructor(private readonly commands: CommandBus) {}

  async handle(request: HttpRequest<{ body: IssueInvoiceBody }>): Promise<IssueInvoiceAccepted> {}
}`,
  },
  'presentation/controller-delegates': {
    why: 'A controller holds no business logic, and the way to keep it so is to give it nothing to decide with. What it may be given is the bus of its method, a request mapper and a serializer. With a repository, a port or a domain service in its constructor, a rule would be written at the edge, where a job or an event handler calling the same use case does not pass.',
    bad: `@Controller({ group: InvoicesRoutes, method: 'GET', path: '/:invoiceId', summary: 'Get invoice', response: { status: 200, body: answer } })
export class GetInvoiceController {
  constructor(
    private readonly commands: CommandBus,
    private readonly invoices: InvoiceRepository,
  ) {}
}`,
    good: `@Controller({ group: InvoicesRoutes, method: 'GET', path: '/:invoiceId', summary: 'Get invoice', response: { status: 200, body: answer } })
export class GetInvoiceController {
  constructor(
    private readonly queries: QueryBus,
    private readonly serializer: GetInvoiceSerializer,
  ) {}
}`,
  },
  'presentation/shared-cache-varies': {
    why: 'A shared cache (Varnish, a CDN) files an answer by its URL and hands it to the next caller who asks the same URL. The answer of a route that knows its caller went through a decision of authorization made for that caller: its permission, its access scope, its tenant. Kept in a shared cache, it is served to the next caller without that decision being made again. A `public` cache policy on such a route must say what the answer depends on, in `vary`, so that the cache keeps one answer per value of it; usually the answer is `private` instead.',
    bad: `@RouteGroup({
  prefix: '/agenda',
  guards: [Authenticated],
  cache: { scope: CacheScope.public, maxAge: '1m' },
})
export class AgendaRoutes {}`,
    good: `@RouteGroup({
  prefix: '/agenda',
  guards: [Authenticated],
  cache: { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' },
})
export class AgendaRoutes {}`,
  },
  'presentation/guard-at-the-edge': {
    why: 'A guard is a control at the edge over a set of routes: is the caller authenticated, does it hold a role, does the tenant of its token match the one of the path, is the key of the request known. A business permission is another thing: it depends on the element (who owns this appointment, is this invoice still a draft) and it is declared on the use case with `@Requires`, so that a job or an event handler sending the same command is held to the same right. A guard that loads an aggregate decides a permission at the one door where not every caller passes.',
    bad: `import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';

@Guard()
export class OwnAppointmentGuard implements Guard {
  constructor(private readonly appointments: AppointmentRepository) {}
}`,
    good: `@Guard()
export class SameClinicGuard implements Guard {
  readonly documents = { errors: ['FORBIDDEN'] };

  check({ actor, params }: GuardRequest): void {
    if (actor.tenantId !== params['clinicId']) {
      throw new ForbiddenError('The caller belongs to another clinic');
    }
  }
}`,
  },
  'test/no-only-no-skip': {
    why: 'A test left aside makes the run green while something is not proven. `.only` was written to debug one test and forgotten: the others no longer run. `.skip` keeps a test in the file while nothing holds it, and the day it would have failed nobody is told; `.skipIf(true)` and `.runIf(false)` are the same thing with a condition that never changes. The kit names what is not proven yet instead: an `it.todo` with the behaviour as its title, which `ddd-ts-kit todo` lists and `story --gate close` refuses while one belongs to the story.',
    bad: `it.only('refuses to pay an invoice twice', () => { ... });
describe.skip('Invoice', () => { ... });
it.skipIf(true)('records the payment', () => { ... });`,
    good: `it('refuses to pay an invoice twice', () => { ... });
it.todo('refuses to pay an invoice whose customer is closed');
describe.runIf(process.env['VARNISH_URL'] !== undefined)('through Varnish', () => { ... });`,
  },
  'test/title-states-a-rule': {
    why: 'The titles of a spec are the only part of it the whole team reads: the report of a failed run, the list `npm test` prints, the review. Written as rules, in the words of the business, they are the specification of the unit, and a new test is written by stating one more rule. Written as `should ...`, `test ...` or after a method, they say that something is tested without saying what is true, and the reader opens the body to find out.',
    bad: `describe('Invoice tests', () => {
  it('should refuse a second payment', () => { ... });
  it('execute() saves the invoice', () => { ... });
  it('Pays the invoice correctly', () => { ... });
});`,
    good: `describe('Invoice', () => {
  it('refuses to pay an invoice twice', () => { ... });
  it('saves the invoice and answers its identifier', () => { ... });
  it('#US5.02 AC1 a customer places an order', pending(async () => { ... }));
  it.each(kinds)('%s announces an appointment to come', (kind) => { ... });
});`,
  },
  'test/no-logic': {
    why: 'A test is read without being run: it arranges a state, acts once, asserts what is true afterwards, and fails for one reason. An `if` in a test is a second test hiding in the first, or a path the test takes without saying which; a loop asserts several cases under one title, and the report names none of them; a `try` catches what the runner would have reported with its stack. The logic a test seems to need belongs to what it uses: a builder decides how a paid invoice is built, a fake decides when the mailer fails, a helper decides what a page holds.',
    bad: `it('accepts every kind', () => {
  for (const kind of kinds) {
    expect(NotificationKind.create(kind).value).toBe(kind);
  }
});

it('refuses a second payment', () => {
  try {
    invoice.pay(at);
  } catch (error) {
    expect(error).toMatchObject({ code: 'INVOICE_ALREADY_PAID' });
  }
});`,
    good: `it.each(kinds)('accepts the kind %s', (kind) => {
  expect(NotificationKind.create(kind).value).toBe(kind);
});

it('refuses a second payment', () => {
  given(anInvoice().paid())
    .when((invoice) => invoice.pay(at))
    .thenError('INVOICE_ALREADY_PAID');
});`,
  },
  'test/assertion-present': {
    why: 'A test that asserts nothing passes whatever the code does, and raises the coverage rate while proving nothing: it is the gap `test/coverage-governed` cannot see. The kit asserts outcomes: the state of a fake, the facts recorded, the refusal by its code, the answer of a route.',
    bad: `it('issues the invoice', async () => {
  await application.commandBus.execute(new IssueInvoiceCommand(holder, 'customer-1'));
});

it('refuses a second payment');`,
    good: `it('issues the invoice and answers its identifier', async () => {
  const id = await application.commandBus.execute(new IssueInvoiceCommand(holder, 'customer-1'));

  expect(await invoiceRepository.findById(id)).toBeDefined();
});

it.todo('refuses a second payment');`,
  },
  'test/refusal-by-code': {
    why: 'A refusal of the model carries a code and its facts (`INVOICE_ALREADY_PAID`, `{ invoiceId }`): the client receives them in the problem document, the catalogue of the context lists them, the reader of the test learns which rule refused. A message is prose that a rewording changes without changing the rule; the class of one error is an implementation the factories of `domain/errors/` may fold into another. A `toThrow()` without an argument accepts any failure, a `TypeError` of the test included.',
    bad: `expect(() => invoice.pay(at)).toThrow('already paid');
expect(() => invoice.pay(at)).toThrow(InvoiceAlreadyPaid);
expect(() => Email.create('  ')).toThrow();
await expect(bus.execute(command)).rejects.toThrowError(/forbidden/);`,
    good: `given(anInvoice().paid())
  .when((invoice) => invoice.pay(at))
  .thenError('INVOICE_ALREADY_PAID', { invoiceId: 'invoice-1' });

expectRefusal(() => Email.create('  '), 'INVALID_EMAIL', { given: '  ' });

await expect(bus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' });

expectProblem(response, { status: 409, code: 'SLOT_TAKEN' });`,
  },
  'test/no-snapshot': {
    why: 'A snapshot records whatever the code produced the first time, and is renewed with one flag the next time it differs: it asserts nothing a reader can check against the rule, and it fails on every field the rule does not depend on. A test states the fields that matter, built in the test, so that the reader sees the cause of the outcome.',
    bad: `expect(invoice.toState()).toMatchSnapshot();
expect(() => invoice.pay(at)).toThrowErrorMatchingInlineSnapshot();`,
    good: `expect(invoice.toState()).toMatchObject({ status: 'paid', paidAt: at });

given(anInvoice().paid())
  .when((invoice) => invoice.pay(at))
  .thenError('INVOICE_ALREADY_PAID');`,
  },
};
