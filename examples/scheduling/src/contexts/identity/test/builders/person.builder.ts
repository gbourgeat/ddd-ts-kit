import { unwrap } from '@ddd-ts-kit/kernel';
import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Person } from '../../domain/aggregates/person.aggregate.js';
import { DisplayName } from '../../domain/value-objects/display-name.vo.js';
import { Email } from '../../domain/value-objects/email.vo.js';

interface PersonIngredients {
  readonly id: string;
  readonly bornAt: Date;
  readonly displayName: string;
  readonly email: string;
}

export class PersonBuilder extends Builder<PersonIngredients, Person> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  named(displayName: string): this {
    return this.with('displayName', displayName);
  }

  reachedAt(email: string): this {
    return this.with('email', email);
  }

  protected defaults(): Defaults<PersonIngredients> {
    return {
      id: sequence('person'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      displayName: sequence('person-name', (n) => `Person ${n}`),
      email: sequence('person-email', (n) => `person${n}@example.com`),
    };
  }

  protected construct(ingredients: PersonIngredients): Person {
    const contact = {
      displayName: unwrap(DisplayName.create(ingredients.displayName)),
      email: unwrap(Email.create(ingredients.email)),
    };

    return Person.create(ingredients.id, contact, ingredients.bornAt);
  }
}

export function aPerson(): PersonBuilder {
  return new PersonBuilder();
}
