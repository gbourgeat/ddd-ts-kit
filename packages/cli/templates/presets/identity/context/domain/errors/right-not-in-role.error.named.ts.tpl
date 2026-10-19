import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/domain/errors/codes{{alias.ext}}';

export class RightNotInRole extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.RightNotInRole;

  static forRight(right: string) {
    return RightNotInRole.refusal(`A member lends only the rights they hold: ${right}.`, {
      right,
    }).exposing('right');
  }
}
