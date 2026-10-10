import { IsString } from 'class-validator';

export class {{event.pascal}}V{{event.version}}Payload {
  @IsString()
  {{aggregate.camel}}Id = '';

  // TODO(domain): add what downstream contexts need to know about "{{event.words}}", as decorated primitive fields; this is a public contract: inside version {{event.version}} a field can be added, never renamed or removed.
}
