import { ValueObject } from '@ddd-ts-kit/kernel';
import { PracticeError } from '@/contexts/identity/domain/errors/practice.error';
import { RoleName } from '@/contexts/identity/domain/vocabularies/role-name.vocabulary';

export type RoleProps = {
  readonly value: RoleName;
};

const ROLES: readonly RoleName[] = Object.values(RoleName);

export class Role extends ValueObject<RoleProps> {
  private constructor(props: RoleProps) {
    super(props);
  }

  static create(value: string): Role {
    const normalized = value.trim().toLowerCase();
    const known = ROLES.find((role) => role === normalized);

    if (known === undefined) {
      throw PracticeError.unknownRole(value);
    }

    return new Role({ value: known });
  }

  static manager(): Role {
    return new Role({ value: RoleName.Manager });
  }

  is(name: RoleName): boolean {
    return this.props.value === name;
  }

  get value(): RoleName {
    return this.props.value;
  }
}
