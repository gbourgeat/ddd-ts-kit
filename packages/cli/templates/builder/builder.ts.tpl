import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';

interface {{aggregate.pascal}}Ingredients {
  readonly id: string;
{{#if birth.named}}
  readonly {{birth.instant}}: Date;
{{/if}}
  // TODO(domain): add one ingredient per fact a test may need to choose (a customer, lines, a status reached), each with a valid default below; for the ones no rule depends on, draw the default with `generated((faker) => ...)` of @ddd-ts-kit/testing/faker.
}

export class {{aggregate.pascal}}Builder extends Builder<{{aggregate.pascal}}Ingredients, {{aggregate.pascal}}> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

{{#if birth.named}}
  {{birth.instant}}(instant: Date): this {
    return this.with('{{birth.instant}}', instant);
  }

{{/if}}
  // TODO(domain): add one method per state a test needs, named in the ubiquitous language and never after a field, for example `issued(): this { return this.with('issued', true); }`, and replay it in `construct` through the public API of {{aggregate.pascal}}.

  protected defaults(): Defaults<{{aggregate.pascal}}Ingredients> {
{{#if birth.named}}
    return { id: sequence('{{aggregate.kebab}}'), {{birth.instant}}: new Date('2026-01-01T00:00:00.000Z') };
{{/if}}
{{#unless birth.named}}
    return { id: sequence('{{aggregate.kebab}}') };
{{/unless}}
  }

  protected construct(ingredients: {{aggregate.pascal}}Ingredients): {{aggregate.pascal}} {
{{#if birth.named}}
    return {{aggregate.pascal}}.create(ingredients.id, ingredients.{{birth.instant}});
{{/if}}
{{#unless birth.named}}
    return {{aggregate.pascal}}.create(ingredients.id, new Date('2026-01-01T00:00:00.000Z'));
{{/unless}}
  }
}

export function {{aggregate.article}}{{aggregate.pascal}}(): {{aggregate.pascal}}Builder {
  return new {{aggregate.pascal}}Builder();
}
