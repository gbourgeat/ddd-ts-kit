import { ValueObject } from '@ddd-ts-kit/kernel';

export type DeskProps = {
  readonly practiceId: string;
  readonly practitionerId: string;
};

export class Desk extends ValueObject<DeskProps> {
  private constructor(props: DeskProps) {
    super(props);
  }

  static create(practiceId: string, practitionerId: string): Desk {
    return new Desk({ practiceId, practitionerId });
  }

  get practiceId(): string {
    return this.props.practiceId;
  }

  get practitionerId(): string {
    return this.props.practitionerId;
  }
}
