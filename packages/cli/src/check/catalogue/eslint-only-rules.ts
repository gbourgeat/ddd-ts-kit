/**
 * Rules of the architecture reference that need a syntax tree: `@ddd-ts-kit/eslint-plugin`
 * holds them, this checker only knows their ids so that the config may set their severity.
 */
export const ESLINT_ONLY_RULES: readonly { readonly id: string; readonly description: string }[] = [
  { id: 'domain/aggregate-encapsulation', description: 'An aggregate or entity has a private or protected constructor, no public mutable property and no setter.' },
  { id: 'domain/value-object-immutability', description: 'A value object has only readonly properties and never assigns to itself outside its constructor.' },
  { id: 'domain/no-generic-error', description: 'domain/ and application/ never `throw new Error(...)`: a business failure is a DomainError subclass.' },
  { id: 'application/handler-shape', description: 'A *.handler.ts file exports one class with a single public method, execute.' },
  { id: 'application/command-query-separation', description: 'A query handler never saves, deletes or publishes.' },
];
