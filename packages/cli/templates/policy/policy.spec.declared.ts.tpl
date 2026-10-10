import { describe, expect, it } from '{{tests.module}}';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { declarationOf } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}Policy } from '../../application/authorization/{{name.kebab}}.policy.js';

describe('{{name.title}}', () => {
  it('bears on the permission {{access.permission}}, under a name of its own', () => {
    expect(declarationOf({{name.pascal}}Policy)).toMatchObject({
      role: 'policy',
      name: '{{context.kebab}}.{{name.kebab}}',
      permission: { id: '{{context.kebab}}:{{access.permission}}' },
    });
  });

  it('refuses a caller nobody identified', () => {
    const policy = new {{name.pascal}}Policy();

    expect(policy.allows(anonymousActor())).toBe(false);
    expect(policy.allows(anActor().build())).toBe(true);
  });

  // TODO(domain): replace each entry below by a case of the rule, with an element built by the builders of test/builders.
  it.todo('allows the actor the rule is written for');
  it.todo('refuses every other actor, whatever their role');
});
