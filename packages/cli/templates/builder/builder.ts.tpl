import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate.js';

interface {{aggregate.pascal}}Ingredients {
  readonly id: string;
  readonly bornAt: Date;
  // TODO(domain): add one ingredient per fact a test may need to choose (a customer, lines, a status reached), each with a valid default below; for the ones no rule depends on, draw the default with `generated((faker) => ...)` of @ddd-ts-kit/testing/faker.
}

export class {{aggregate.pascal}}Builder extends Builder<{{aggregate.pascal}}Ingredients, {{aggregate.pascal}}> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  // TODO(domain): add one method per state a test needs, named in the ubiquitous language and never after a field, for example `issued(): this { return this.with('issued', true); }`, and replay it in `construct` through the public API of {{aggregate.pascal}}.

  protected defaults(): Defaults<{{aggregate.pascal}}Ingredients> {
    return { id: sequence('{{aggregate.kebab}}'), bornAt: new Date('2026-01-01T00:00:00.000Z') };
  }

  protected construct(ingredients: {{aggregate.pascal}}Ingredients): {{aggregate.pascal}} {
    return {{aggregate.pascal}}.create(ingredients.id, ingredients.bornAt);
  }
}

export function {{aggregate.article}}{{aggregate.pascal}}(): {{aggregate.pascal}}Builder {
  return new {{aggregate.pascal}}Builder();
}
