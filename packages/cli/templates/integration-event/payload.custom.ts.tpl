export interface {{event.pascal}}V{{event.version}}Payload {
  readonly {{aggregate.camel}}Id: string;
  // TODO(domain): add what downstream contexts need to know about "{{event.words}}", as readonly primitives; this is a public contract: inside version {{event.version}} a field can be added, never renamed or removed.
}
