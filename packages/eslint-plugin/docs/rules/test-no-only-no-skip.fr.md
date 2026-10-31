[English](test-no-only-no-skip.md) · **Français**
<!-- translation-of: test-no-only-no-skip.md sha256:0f9a49cfc5f76ea6 -->

# ddd-ts-kit/test-no-only-no-skip

Identifiant d'architecture : `test/no-only-no-skip` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier de test du projet (`*.spec.ts`, `*.test.ts`, le `test/` d'un contexte).

## Pourquoi

Un test laissé de côté rend l'exécution verte alors que quelque chose n'est pas prouvé. Le `.only` a été écrit pour déboguer un test et oublié : les autres ne tournent plus. `.skip` garde un test dans le fichier alors que rien ne le tient, et le jour où il aurait échoué personne n'est prévenu ; `.skipIf(true)` et `.runIf(false)` sont la même chose avec une condition qui ne change jamais. Le kit nomme plutôt ce qui n'est pas encore prouvé : un `it.todo` dont le titre est le comportement, que `ddd-ts-kit todo` liste et que `story --gate close` refuse tant qu'il appartient à la *story*.

## Signalé

- `it.only`, `test.only`, `describe.only`, seul ou après un autre modificateur (`it.concurrent.only`)
- `it.skip`, `test.skip`, `describe.skip`
- `it.skipIf`, `it.runIf`, `describe.skipIf`, `describe.runIf` sur une constante (`true`, `false`, une chaîne) ou sur rien
- `fit`, `xit`, `xtest`, `fdescribe`, `xdescribe`

Incorrect :

```ts
it.only('refuses to pay an invoice twice', () => { ... });
describe.skip('Invoice', () => { ... });
it.skipIf(true)('records the payment', () => { ... });
```

Correct :

```ts
it('refuses to pay an invoice twice', () => { ... });
it.todo('refuses to pay an invoice whose customer is closed');
describe.runIf(process.env['VARNISH_URL'] !== undefined)('through Varnish', () => { ... });
```

## Détails

`it.todo`, `it.each`, `it.concurrent` et `it.sequential` ne sont pas signalés : ils s'exécutent, ou nomment ce qui reste à écrire. `skipIf` et `runIf` sur une expression ne le sont pas non plus : ils disent où un test s'exécute, comme les tests à travers un cache HTTP s'exécutent là où le *pipeline* en démarre un ; le test y est alors exécuté, pas laissé de côté. Un test faux pour de bon est supprimé, avec la raison dans le *commit*.

La règle lit les `it`, `test` et `describe` du lanceur, importés de `vitest` ou de `@jest/globals` ou globaux ; une variable locale du même nom n'est pas jugée.

## Options

Aucune.

`rules."test/no-only-no-skip"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line test/no-only-no-skip -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Le lanceur est lu sous un alias d'import (`import { it as scenario } from 'vitest'`) et un alias `const` (`const scenario = it`) ; un modificateur pris à part (`const only = it.only`) ou un lanceur tiré de `it.extend(...)` n'est pas suivi.
- Une condition constante sans être un littéral (`const NEVER = false; it.skipIf(!NEVER)`) est lue comme une condition.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car lire un test demande un arbre syntaxique.
