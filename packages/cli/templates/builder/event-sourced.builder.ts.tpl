import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

interface {{aggregate.pascal}}Ingredients {
  readonly id: string;
  readonly {{event.instant}}: Date;
  // TODO(domain): add one ingredient per fact a test may need to choose, each with a valid default below.
}

/** Builds {{aggregate.pascal}} the way a load does: by replaying a history of events. */
export class {{aggregate.pascal}}Builder extends Builder<{{aggregate.pascal}}Ingredients, {{aggregate.pascal}}> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  {{event.instant}}(instant: Date): this {
    return this.with('{{event.instant}}', instant);
  }

  // TODO(domain): add one method per state a test needs, named in the ubiquitous language, and add the events that reach it to the history replayed in `construct`.

  protected defaults(): Defaults<{{aggregate.pascal}}Ingredients> {
    return { id: sequence('{{aggregate.kebab}}'), {{event.instant}}: new Date('2026-01-01T00:00:00.000Z') };
  }

  protected construct(ingredients: {{aggregate.pascal}}Ingredients): {{aggregate.pascal}} {
    return {{aggregate.pascal}}.rehydrate(ingredients.id, {
      events: [new {{event.pascal}}(ingredients.id, ingredients.{{event.instant}})],
    });
  }
}

export function {{aggregate.article}}{{aggregate.pascal}}(): {{aggregate.pascal}}Builder {
  return new {{aggregate.pascal}}Builder();
}
