import { describe, expect, it } from '{{tests.module}}';
import { givenEvents } from '@ddd-ts-kit/testing';
import { {{name.pascal}} } from '{{alias.context}}/domain/aggregates/{{name.kebab}}.aggregate{{alias.ext}}';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

const bornAt = new Date('2026-03-01T00:00:00.000Z');

describe('{{name.pascal}}', () => {
  it('records its birth, and holds the state that event gives', () => {
    const born = {{name.pascal}}.create('{{name.kebab}}-7', bornAt);

    expect(born.registeredAt).toEqual(bornAt);
    expect(born.pullEvents()).toEqual([new {{event.pascal}}('{{name.kebab}}-7', bornAt)]);
  });

  it('is rebuilt from its history, recording nothing', () => {
    givenEvents((id, history) => {{name.pascal}}.rehydrate(id, history), [new {{event.pascal}}('{{name.kebab}}-7', bornAt)])
      .when((loaded) => loaded.toState())
      .thenNoEvent()
      .thenState((loaded) => expect(loaded.version).toBe(1));
  });

  // TODO(domain): replace each entry below by a test named after the business rule it proves: given the events of a history, when one command, then the events it records (`thenEvents`) or the refusal (`thenError`).
  it.todo('refuses to be born when a birth invariant is violated');
  it.todo('records a fact for each business intention, and changes state only through it');
});
