import { describe, expect, it } from '{{tests.module}}';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { {{name.camel}} } from '{{alias.context}}/application/authorization/{{name.kebab}}.policy.js';

const now = new Date('2026-01-01T00:00:00.000Z');

describe('{{name.title}}', () => {
  it('bears on the permission {{access.permission}}', () => {
    expect({{name.camel}}.permission.id).toBe('{{context.kebab}}:{{access.permission}}');
  });

  it('refuses a caller nobody identified', () => {
    expect({{name.camel}}.allows(anonymousActor(), {}, { now })).toBe(false);
    expect({{name.camel}}.allows(anActor().build(), {}, { now })).toBe(true);
  });

  // TODO(domain): replace each entry below by a case of the rule, with an element built by the builders of test/builders.
  it.todo('allows the actor the rule is written for');
  it.todo('refuses every other actor, whatever their role');
});
