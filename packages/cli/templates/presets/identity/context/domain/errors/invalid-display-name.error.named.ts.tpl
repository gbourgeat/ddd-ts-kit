import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { {{context.pascal}}Codes } from '{{alias.context}}/{{context.kebab}}.codes{{alias.ext}}';

export class InvalidDisplayName extends DomainRefusal {
  readonly code = {{context.pascal}}Codes.InvalidDisplayName;

  static forValue(raw: string) {
    return InvalidDisplayName.refusal('A display name holds between 1 and 100 characters.', { raw });
  }
}
