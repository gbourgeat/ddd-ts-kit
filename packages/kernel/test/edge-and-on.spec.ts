import { describe, expect, it } from 'vitest';
import { DeclarationError, Edge, On, Projection, declarationOf, type EventContract } from '../src/declarations.js';
import { ok, type IntegrationEvent } from '../src/index.js';
import { MoneyDeposited, MoneyWithdrawn } from './support/bank/account.js';

const MISPLACED = '@On is written on a public instance method with a string name.';

describe('Edge', () => {
  it('declares a class of the edge under the word of its transport', () => {
    class VisitsController {}

    Edge('controller')(VisitsController);

    expect(declarationOf(VisitsController)).toEqual({
      role: 'edge',
      part: 'controller',
      implementation: VisitsController,
      dependencies: undefined,
    });
  });

  it.each(['Controller', 'request mapper', '-guard', ''])(
    'refuses the part "%s", which is not lower-case words',
    (part) => {
      expect(() => Edge(part)).toThrow(DeclarationError);
      expect(() => Edge(part)).toThrow(`An edge part is named in lower-case words, and "${part}" is not.`);
    },
  );
});

type Applying<Event = MoneyDeposited> = (this: object, event: Event) => Promise<unknown>;

const PractitionerRenamed: EventContract<unknown> = {
  type: 'directory.practitioner.renamed',
  version: 1,
  parse: (event) => ok(event),
};

/** What the standard (TC39) decorator call hands `@On` for a method: the compiler of the specs does not lower it. */
function standardContext<Event = MoneyDeposited>(
  name: string | symbol,
  placement: { readonly static: boolean; readonly private: boolean },
): ClassMethodDecoratorContext<object, Applying<Event>> {
  return {
    kind: 'method',
    name,
    ...placement,
    access: { has: () => true, get: () => async () => undefined },
    addInitializer: () => undefined,
    metadata: {},
  };
}

describe('On', () => {
  it('declares, in the standard decorator mode, the public method it is written on', () => {
    class StandardBalances {
      async deposited(_event: MoneyDeposited): Promise<void> {}
    }

    On(MoneyDeposited)(
      StandardBalances.prototype.deposited,
      standardContext('deposited', { static: false, private: false }),
    );

    Projection('bank.standard-balances')(StandardBalances);

    expect(declarationOf(StandardBalances)).toMatchObject({
      role: 'projection',
      name: 'bank.standard-balances',
      applies: [{ kind: 'domain', method: 'deposited', event: MoneyDeposited, name: 'bank.account.deposited' }],
    });
  });

  it('declares, in the standard decorator mode, a method that applies an integration event of an upstream context', () => {
    class PractitionerNames {
      async renamed(_event: IntegrationEvent): Promise<void> {}
    }

    On(PractitionerRenamed)(
      PractitionerNames.prototype.renamed,
      standardContext<IntegrationEvent>('renamed', { static: false, private: false }),
    );

    Projection('clinic.practitioner-names')(PractitionerNames);

    expect(declarationOf(PractitionerNames)).toMatchObject({
      applies: [{ kind: 'integration', method: 'renamed', contract: PractitionerRenamed }],
    });
  });

  it.each([
    ['a static method', 'deposited', { static: true, private: false }],
    ['a private method', '#deposited', { static: false, private: true }],
    ['a method named by a symbol', Symbol('deposited'), { static: false, private: false }],
  ] as const)('refuses, in the standard decorator mode, %s', (_label, name, placement) => {
    const applying: Applying = async () => undefined;

    expect(() => On(MoneyDeposited)(applying, standardContext(name, placement))).toThrow(DeclarationError);
    expect(() => On(MoneyDeposited)(applying, standardContext(name, placement))).toThrow(MISPLACED);
  });

  it('is read in the legacy decorator mode too, on the prototype it is handed', () => {
    class LegacyBalances {
      async deposited(_event: MoneyDeposited): Promise<void> {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(LegacyBalances.prototype, 'deposited') ?? {};

    On(MoneyDeposited)(LegacyBalances.prototype, 'deposited', descriptor);
    Projection('bank.legacy-balances')(LegacyBalances);

    expect(declarationOf(LegacyBalances)).toMatchObject({
      role: 'projection',
      name: 'bank.legacy-balances',
      applies: [{ kind: 'domain', method: 'deposited', event: MoneyDeposited, name: 'bank.account.deposited' }],
    });
  });

  it('refuses, in the legacy mode, a method named by a symbol', () => {
    class LegacyBalances {}

    expect(() => On(MoneyWithdrawn)(LegacyBalances.prototype, Symbol('withdrawn'), {})).toThrow(MISPLACED);
  });

  it('is claimed, in the legacy mode, only by the projection of the prototype it was written on', () => {
    class Written {
      async withdrawn(_event: MoneyWithdrawn): Promise<void> {}
    }

    class Declared {
      async withdrawn(_event: MoneyWithdrawn): Promise<void> {}
    }

    On(MoneyWithdrawn)(Written.prototype, 'withdrawn', {});

    expect(() => Projection('bank.other-balances')(Declared)).toThrow(
      /@On is written on the method "withdrawn" of a class that carries no @Projection: found while declaring Declared/,
    );
  });
});
