import { describe, expect, it } from '{{tests.module}}';
import { given } from '@ddd-ts-kit/testing';
import { {{name.pascal}} } from '{{alias.context}}/domain/aggregates/{{name.kebab}}.aggregate{{alias.ext}}';
{{#if birth.named}}
import { {{birth.pascal}} } from '{{alias.context}}/domain/events/{{birth.kebab}}.event{{alias.ext}}';
{{/if}}
import { {{name.article}}{{name.pascal}} } from '{{alias.context}}/test/builders/{{name.kebab}}.builder{{alias.ext}}';

describe('{{name.title}}', () => {
  it('is born with its identity', () => {
    const born = {{name.article}}{{name.pascal}}().identifiedBy('{{name.kebab}}-7').build();

    expect(born.id).toBe('{{name.kebab}}-7');
  });

{{#if birth.named}}
  it('records the fact of its birth, {{birth.words}}, at the instant it is given', () => {
    const {{birth.instant}} = new Date('2026-03-01T00:00:00.000Z');

    const born = {{name.article}}{{name.pascal}}().identifiedBy('{{name.kebab}}-7').{{birth.instant}}({{birth.instant}}).build();

    expect(born.pullEvents()).toEqual([new {{birth.pascal}}('{{name.kebab}}-7', {{birth.instant}})]);
  });

{{/if}}
  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = {{name.article}}{{name.pascal}}().build();

    const loaded = {{name.pascal}}.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('records nothing as long as no business intention is expressed', () => {
    // TODO(domain): replace `toState` by a business method of {{name.pascal}} and `[]` by the facts it records, for example `[{ name: '{{context.kebab}}.{{name.kebab}}.issued' }]`.
    given({{name.article}}{{name.pascal}}())
      .when((subject) => subject.toState())
      .thenEvents([]);
  });

  // TODO(domain): replace each entry below by a given / when / then test named after the business rule it proves: a built state, one intention, then the recorded facts (`thenEvents`) or the raised error (`thenError`).
{{#unless birth.named}}
  it.todo('records the fact of its birth');
{{/unless}}
  it.todo('refuses to be born when a birth invariant is violated');
  it.todo('changes state and records a fact for each business intention');
});
