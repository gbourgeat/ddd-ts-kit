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
    description: 'domain/ and application/ never `throw new Error(...)`: a business failure is a DomainError subclass.',
  },
  {
    id: 'errors/through-factory',
    description:
      'Under "stack.refusals": "factories", a domain error is built by a static factory of its concept class: no `new` of a class of domain/errors/ outside that class.',
  },
  {
    id: 'errors/constructor-not-public',
    description:
      'Under "stack.refusals": "factories", the constructor of an error class of domain/errors/ is not public: the class extends ConceptError and declares none, or declares it private or protected.',
  },
  {
    id: 'errors/factory-name',
    description:
      'Under "stack.refusals": "factories", a static factory of an error class is named after the refusal, never `create`, `make`, `of` or `error1`, and its code is that name in constant case, alone or with the name of the concept.',
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
    id: 'presentation/guard-at-the-edge',
    description:
      'A *.guard.ts file imports nothing from domain/ or infrastructure/, no repository, no unit of work and no command bus.',
  },
];
