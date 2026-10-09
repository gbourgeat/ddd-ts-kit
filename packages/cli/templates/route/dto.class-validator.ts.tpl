{{#if route.dtoHasFields}}
import { IsString } from 'class-validator';

{{/if}}
{{#if route.hasParams}}
export class {{name.pascal}}Params {
{{route.dtoParams}}
}

{{/if}}
{{#if route.hasBody}}
export class {{name.pascal}}Body {
  // TODO(domain): declare the fields the client sends for "{{name.words}}", each with its class-validator decorators (shape constraints only; business rules stay in the domain).
}

{{/if}}
{{#if route.isQuery}}
export class {{name.pascal}}Answer {
  // TODO(domain): declare the fields of {{name.pascal}}Result that are part of the public contract, each with its class-validator decorators.
}

{{/if}}
{{#if route.returnsId}}
export class {{name.pascal}}Accepted {
  @IsString()
  id = '';
}
{{/if}}
