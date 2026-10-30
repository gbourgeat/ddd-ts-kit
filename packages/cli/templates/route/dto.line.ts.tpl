import { IsString } from 'class-validator';

export class {{name.pascal}}Line {
  @IsString()
  declare id: string;

  // TODO(domain): declare the fields of {{name.pascal}}Item that are part of the public contract, each with its class-validator decorators and `declare`d without an initial value.
}
