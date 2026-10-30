import { describe, expect, it } from '{{tests.module}}';
import { givenEvents } from '@ddd-ts-kit/testing';
import { {{name.pascal}} } from '{{alias.context}}/domain/aggregates/{{name.kebab}}.aggregate{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';
import { {{name.article}}{{name.pascal}} } from '{{alias.context}}/test/builders/{{name.kebab}}.builder{{alias.ext}}';

const {{event.instant}} = new Date('2026-03-01T00:00:00.000Z');

describe('{{name.title}}', () => {
  it('records its birth, and holds the state that event gives', () => {
    const born = {{name.pascal}}.create('{{name.kebab}}-7', {{event.instant}});

    expect(born.{{event.instant}}).toEqual({{event.instant}});
    expect(born.pullEvents()).toEqual([new {{event.pascal}}('{{name.kebab}}-7', {{event.instant}})]);
  });

  it('is rebuilt from its history, recording nothing', () => {
    givenEvents((id, history) => {{name.pascal}}.rehydrate(id, history), [new {{event.pascal}}('{{name.kebab}}-7', {{event.instant}})])
      .when((loaded) => loaded.toState())
      .thenNoEvent()
      .thenState((loaded) => expect(loaded.version).toBe(1));
  });

  it('is loaded by its builder in the state its birth gives, recording nothing', () => {
    const loaded = {{name.article}}{{name.pascal}}().identifiedBy('{{name.kebab}}-7').{{event.instant}}({{event.instant}}).build();

    expect(loaded.{{event.instant}}).toEqual({{event.instant}});
    expect(loaded.pullEvents()).toEqual([]);
  });

  // TODO(domain): replace each entry below by a test named after the business rule it proves: given the events of a history, when one command, then the events it records (`thenEvents`) or the refusal (`thenError`).
  it.todo('refuses to be born when a birth invariant is violated');
  it.todo('records a fact for each business intention, and changes state only through it');
});
