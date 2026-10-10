import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Delegation } from '#src/contexts/identity/domain/aggregates/delegation.aggregate.js';
import { Desk } from '#src/contexts/identity/domain/value-objects/desk.vo.js';

interface DelegationIngredients {
  readonly id: string;
  readonly bornAt: Date;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly assistantId: string;
  readonly availabilityIncluded: boolean;
  readonly endsAt: Date | undefined;
  readonly revokedAt: Date | undefined;
}

export class DelegationBuilder extends Builder<DelegationIngredients, Delegation> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  onDesk(practiceId: string, practitionerId: string): this {
    return this.with('practiceId', practiceId).with('practitionerId', practitionerId);
  }

  givenTo(assistantId: string): this {
    return this.with('assistantId', assistantId);
  }

  includingAvailability(): this {
    return this.with('availabilityIncluded', true);
  }

  endingAt(instant: Date): this {
    return this.with('endsAt', instant);
  }

  revokedAt(instant: Date): this {
    return this.with('revokedAt', instant);
  }

  protected defaults(): Defaults<DelegationIngredients> {
    return {
      id: sequence('delegation'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      practiceId: 'practice-1',
      practitionerId: 'practitioner-1',
      assistantId: 'assistant-1',
      availabilityIncluded: false,
      endsAt: undefined,
      revokedAt: undefined,
    };
  }

  protected construct(ingredients: DelegationIngredients): Delegation {
    const { assistantId, availabilityIncluded, endsAt } = ingredients;
    const desk = Desk.create(ingredients.practiceId, ingredients.practitionerId);

    const granted = Delegation.create(
      ingredients.id,
      { desk, assistantId, availabilityIncluded, endsAt },
      ingredients.bornAt,
    );

    if (ingredients.revokedAt !== undefined) {
      granted.revoke(ingredients.revokedAt);
    }

    return granted;
  }
}

export function aDelegation(): DelegationBuilder {
  return new DelegationBuilder();
}
