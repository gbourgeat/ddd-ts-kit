[English](test-no-mocks.md) · **Français**
<!-- translation-of: test-no-mocks.md sha256:b60a08dea89be978 -->

# ddd-ts-kit/test-no-mocks

Identifiant d'architecture : `test/no-mocks`. Sévérité par défaut : `warn` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de test d'un contexte (`test/**`, `*.spec.ts`, `*.test.ts`).

## Pourquoi

Un *mock* vérifie des appels, pas des résultats, et casse à chaque refactorisation. Un *fake* (double de test) est une implémentation en mémoire du port qui fonctionne vraiment, tenue à la même suite de contrat que l'adaptateur réel.

## Signalé

- `vi.mock`, `vi.doMock`, `vi.fn`, `vi.spyOn`, `vi.mocked` et leurs jumeaux de `jest`
- un import de `sinon`, `ts-mockito`, `jest-mock`, `jest-mock-extended`, `vitest-mock-extended`, `testdouble`, `ts-auto-mock`, `typemoq`, `moq.ts`, `@golevelup/ts-jest`, `@golevelup/ts-vitest`

Incorrect :

```ts
const save = vi.fn();
vi.mock('@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository');
```

Correct :

```ts
const invoices = new FakeInvoiceRepository();
await handler.execute(command);
expect(await invoices.findById(id)).toBeDefined();
```

## Détails

`vi.useFakeTimers` et `vi.setSystemTime` ne sont pas des *mocks* d'un collaborateur et sont permis, même si `FixedClock` est la façon habituelle.

## Options

Aucune.

`rules."test/no-mocks"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line test/no-mocks -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Les tests hors d'un contexte (`test/e2e`) ne sont pas jugés.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant avec des expressions régulières. Cette règle fait autorité.
