import { IsString } from 'class-validator';

export class {{name.pascal}}Line {
  @IsString()
  id = '';

  // TODO(domain): declare the fields of {{name.pascal}}Item that are part of the public contract, each with its class-validator decorators.
}
