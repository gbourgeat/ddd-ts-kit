import { ValueObject } from '@ddd-ts-kit/kernel';
import type { Role, RoleName } from '@/contexts/identity/domain/value-objects/role.vo.js';

export type MembershipProps = {
  readonly personId: string;
  readonly role: RoleName;
};

export class Membership extends ValueObject<MembershipProps> {
  private constructor(props: MembershipProps) {
    super(props);
  }

  static create(personId: string, role: Role): Membership {
    return new Membership({ personId, role: role.value });
  }

  isOf(personId: string): boolean {
    return this.props.personId === personId;
  }

  has(role: RoleName): boolean {
    return this.props.role === role;
  }

  get personId(): string {
    return this.props.personId;
  }

  get role(): RoleName {
    return this.props.role;
  }
}
