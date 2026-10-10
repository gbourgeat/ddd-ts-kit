import { IsString } from 'class-validator';

export class {{name.pascal}}Accepted {
  @IsString()
  id = '';
}
