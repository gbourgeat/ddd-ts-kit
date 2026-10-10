import { describe, expect, it } from '{{tests.module}}';
import type { Permission } from '@ddd-ts-kit/auth';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions.js';

describe('The permissions of {{context.kebab}}', () => {
  it('belong to {{context.kebab}}, each under an identifier of its own and with a description', () => {
    const permissions: readonly Permission[] = Object.values({{context.camel}}Permissions);
    const identifiers = permissions.map((permission) => permission.id);

    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(permissions.filter((permission) => permission.context !== '{{context.kebab}}')).toEqual([]);
    expect(permissions.filter((permission) => permission.description.trim() === '')).toEqual([]);
  });
});
