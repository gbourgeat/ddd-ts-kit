import { IsString } from 'class-validator';

export class {{event.pascal}}V{{event.version}}Payload {
  @IsString()
  declare {{aggregate.camel}}Id: string;

  // TODO(domain): add what downstream contexts need to know about "{{event.words}}", as decorated primitive fields `declare`d without an initial value, so that a payload without one is refused; this is a public contract: inside version {{event.version}} a field can be added, never renamed or removed.
}
