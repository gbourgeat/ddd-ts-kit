import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { UnknownRoleError } from '#src/contexts/identity/domain/errors/unknown-role.error.js';

export type RoleName = 'manager' | 'practitioner' | 'assistant';

export type RoleProps = {
  readonly value: RoleName;
};

const ROLES: readonly RoleName[] = ['manager', 'practitioner', 'assistant'];

export class Role extends ValueObject<RoleProps> {
  private constructor(props: RoleProps) {
    super(props);
  }

  static create(value: string): Result<Role, UnknownRoleError> {
    const normalized = value.trim().toLowerCase();
    const known = ROLES.find((role) => role === normalized);

    if (known === undefined) {
      return err(new UnknownRoleError(value));
    }

    return ok(new Role({ value: known }));
  }

  static manager(): Role {
    return new Role({ value: 'manager' });
  }

  is(name: RoleName): boolean {
    return this.props.value === name;
  }

  get value(): RoleName {
    return this.props.value;
  }
}
