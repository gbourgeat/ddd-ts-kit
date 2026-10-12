import { describe, expect, it } from 'vitest';
import { Clock } from '../src/index.js';
import { DeclarationError, injected, injectedDependencies } from '../src/declarations.js';

describe('a dependency list registered for a class', () => {
  abstract class Ledger {
    abstract post(): void;
  }

  class PostEntries {
    constructor(
      readonly ledger: Ledger,
      readonly clock: Clock,
    ) {}
  }

  it('is answered as it was registered, frozen, and nothing for a class or a value never registered', () => {
    class Unregistered {}

    injected(PostEntries, [Ledger, Clock]);

    expect(injectedDependencies(PostEntries)).toEqual([Ledger, Clock]);
    expect(Object.isFrozen(injectedDependencies(PostEntries))).toBe(true);
    expect(injectedDependencies(Unregistered)).toBeUndefined();
    expect(injectedDependencies('PostEntries')).toBeUndefined();
  });

  it('may be registered again as it is, and is refused when two generated files disagree', () => {
    class CloseTheBooks {
      constructor(readonly ledger: Ledger) {}
    }

    class Reopen {}

    injected(CloseTheBooks, [Ledger]);
    injected(Reopen);

    expect(() => injected(CloseTheBooks, [Ledger])).not.toThrow();
    expect(injectedDependencies(Reopen)).toEqual([]);

    expect(() => Reflect.apply(injected, undefined, [CloseTheBooks, [Clock]])).toThrow(DeclarationError);

    expect(() => Reflect.apply(injected, undefined, [CloseTheBooks, [Clock]])).toThrow(
      /CloseTheBooks is given two dependency lists, \[Ledger\] and \[Clock\].*ddd-ts-kit docs/,
    );
  });
});
