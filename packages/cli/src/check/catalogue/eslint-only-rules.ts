/**
 * Rules of the architecture reference that need a syntax tree: `@ddd-ts-kit/eslint-plugin`
 * holds them, this checker only knows their ids so that the config may set their severity.
 */
export const ESLINT_ONLY_RULES: readonly { readonly id: string; readonly description: string }[] = [
  {
    id: 'domain/aggregate-encapsulation',
    description:
      'An aggregate or entity has a private or protected constructor, no public mutable property and no setter.',
  },
  {
    id: 'domain/value-object-immutability',
    description: 'A value object has only readonly properties and never assigns to itself outside its constructor.',
  },
  {
    id: 'domain/no-generic-error',
    description:
      'domain/ and application/ never `throw new Error(...)`, nor another error of the language, directly or through a `const`: a business failure is a DomainError subclass.',
  },
  {
    id: 'errors/through-factory',
    description:
      'Under "stack.refusals": "factories" or "named", a domain error is built by a static factory of its class: no `new` of a class of domain/errors/ outside that class, nor of a class extending DomainRefusal.',
  },
  {
    id: 'errors/constructor-not-public',
    description:
      'Under "stack.refusals": "factories" or "named", the constructor of an error class of domain/errors/ is not public: the class extends ConceptError or DomainRefusal and declares none, or declares it private or protected.',
  },
  {
    id: 'errors/factory-name',
    description:
      'Under "stack.refusals": "factories", a static factory of an error class is named after the refusal, never `create`, `make`, `of` or `error1`, and its code is that name in constant case, alone or with the name of the concept. Under "named", the class is named after the refusal, never `...Error`, and a factory after what the refusal is about: for, with, because, on or at, then an upper-case letter, no digit.',
  },
  {
    id: 'clean/no-magic-number',
    description:
      'Under "stack.literals": "named", no number literal in domain/ and application/ but 0, 1, -1, an index, a type and the initializer of a module constant or a `static readonly`.',
  },
  {
    id: 'application/handler-shape',
    description: 'A *.handler.ts file exports one class with a single public method, execute.',
  },
  { id: 'application/command-query-separation', description: 'A query handler never saves, deletes or publishes.' },
  {
    id: 'presentation/controller-shape',
    description:
      'A *.controller.ts file whose class carries @Controller exports that one class, whose single public method is handle.',
  },
  {
    id: 'presentation/controller-delegates',
    description:
      'A controller takes the bus of its method (CommandBus for POST, PUT, PATCH, DELETE; QueryBus for GET, HEAD), a request mapper and a serializer, and nothing else.',
  },
  {
    id: 'presentation/shared-cache-varies',
    description:
      'A route, a controller or a route group that knows its caller (a guard other than Public, security schemes) and declares a public cache policy names in vary the request headers its answer depends on.',
  },
  {
    id: 'presentation/guard-at-the-edge',
    description:
      'A *.guard.ts file imports nothing from domain/ or infrastructure/, no repository, no unit of work and no command bus.',
  },
  {
    id: 'test/no-only-no-skip',
    description:
      'No .only or .skip on a test or a group, no fit, xit or xdescribe, no .skipIf or .runIf on a constant: every test runs, or runs wherever its condition holds; a behaviour not proven yet is an it.todo.',
  },
  {
    id: 'test/title-states-a-rule',
    description:
      'The title of a test states the rule it proves, in lower case, after the rows and the criterion it cites; never should, test, works, nor the name of a method or a class. A describe names the unit.',
  },
  {
    id: 'test/no-logic',
    description:
      'A test holds no if, switch, ternary, loop or try: a case per row is an it.each, a decision belongs to a builder, a fake or a helper.',
  },
  {
    id: 'test/assertion-present',
    description:
      'Every test asserts something: an expect, an expect... or assert... helper, or the outcome of a scenario (thenEvents, thenError); a test without a body is an it.todo.',
  },
  {
    id: 'test/refusal-by-code',
    description:
      'A refusal of the model or of the application is asserted by its code and its facts (thenError, expectRefusal, rejects.toMatchObject({ code }), expectProblem), never by toThrow with a message, a class or nothing; the specs of the adapters and of the platform are not judged.',
  },
  {
    id: 'test/no-snapshot',
    description:
      'No snapshot matcher in a test: a snapshot records whatever the code produced; a test asserts the fields the rule depends on.',
  },
];
