import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{codes.list}} } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class {{name.pascal}} extends DomainRefusal {
  readonly code = {{codes.list}}.{{name.pascal}};

{{error.factory}}
}
