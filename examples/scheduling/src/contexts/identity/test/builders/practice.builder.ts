import { unwrap } from '@ddd-ts-kit/kernel';
import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Practice } from '#src/contexts/identity/domain/aggregates/practice.aggregate.js';
import { DisplayName } from '#src/contexts/identity/domain/value-objects/display-name.vo.js';
import { Role, type RoleName } from '#src/contexts/identity/domain/value-objects/role.vo.js';
import { TimeZone } from '#src/contexts/identity/domain/value-objects/time-zone.vo.js';

interface PracticeIngredients {
  readonly id: string;
  readonly bornAt: Date;
  readonly name: string;
  readonly timeZone: string;
  readonly managerId: string;
  readonly joiners: readonly { readonly personId: string; readonly role: RoleName }[];
}

export class PracticeBuilder extends Builder<PracticeIngredients, Practice> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  named(name: string): this {
    return this.with('name', name);
  }

  inTimeZone(timeZone: string): this {
    return this.with('timeZone', timeZone);
  }

  managedBy(personId: string): this {
    return this.with('managerId', personId);
  }

  withManager(personId: string): this {
    return this.adding('joiners', { personId, role: 'manager' });
  }

  withPractitioner(personId: string): this {
    return this.adding('joiners', { personId, role: 'practitioner' });
  }

  withAssistant(personId: string): this {
    return this.adding('joiners', { personId, role: 'assistant' });
  }

  protected defaults(): Defaults<PracticeIngredients> {
    return {
      id: sequence('practice'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      name: sequence('practice-name', (n) => `Practice ${n}`),
      timeZone: 'Europe/Paris',
      managerId: sequence('manager'),
      joiners: [],
    };
  }

  protected construct(ingredients: PracticeIngredients): Practice {
    const manager = { personId: ingredients.managerId, displayName: nameOf(ingredients.managerId) };
    const opening = { name: ingredients.name, timeZone: unwrap(TimeZone.create(ingredients.timeZone)), manager };
    const opened = Practice.create(ingredients.id, opening, ingredients.bornAt);

    for (const joiner of ingredients.joiners) {
      const newcomer = {
        personId: joiner.personId,
        role: unwrap(Role.create(joiner.role)),
        displayName: nameOf(joiner.personId),
      };

      opened.addMember(newcomer, ingredients.bornAt);
    }

    return opened;
  }
}

function nameOf(personId: string): DisplayName {
  return unwrap(DisplayName.create(`Name of ${personId}`));
}

export function aPractice(): PracticeBuilder {
  return new PracticeBuilder();
}
