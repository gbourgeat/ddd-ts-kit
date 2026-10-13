[English](purity-no-ambient-randomness.md) · **Français**
<!-- translation-of: purity-no-ambient-randomness.md sha256:e417e1fca369697c -->

# ddd-ts-kit/purity-no-ambient-randomness

Identifiant d'architecture : `purity/no-ambient-randomness`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

Un identifiant tiré au hasard au milieu d'une règle ne peut être ni prévu par un test ni rejoué. Les identifiants viennent du port `IdGenerator`.

## Signalé

- `Math.random`
- `crypto.randomUUID`, `getRandomValues`, `randomBytes`, `randomInt`, aussi quand ils sont importés par leur nom depuis `node:crypto`
- un import de `uuid`, `nanoid`, `ulid`, `ulidx`, `cuid`, `@paralleldrive/cuid2`, `ksuid`, `shortid`, `uuidv7`, `hyperid`, `bson`

Incorrect :

```ts
import { v4 } from 'uuid';
const id = crypto.randomUUID();
```

Correct :

```ts
const invoice = Invoice.create(this.ids.next(), this.clock.now());
```

## Options

Aucune.

`rules."purity/no-ambient-randomness"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line purity/no-ambient-randomness -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une enveloppe autour de l'accès interdit (un auxiliaire de la plateforme qui appelle `Date.now()`) n'est pas vue ici ; les règles de couche arrêtent l'import de cet auxiliaire.
- Une déclaration locale qui masque la globale (`const process = ...`) n'est pas signalée.

## Avec le checker de la CLI

`ddd-ts-kit check` cherche les mêmes noms avec des expressions régulières. Cette règle fait autorité : elle distingue un nom masqué de la globale, et du code d'une chaîne.
