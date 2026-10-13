[English](purity-no-system-clock.md) · **Français**
<!-- translation-of: purity-no-system-clock.md sha256:41b999b764a83a88 -->

# ddd-ts-kit/purity-no-system-clock

Identifiant d'architecture : `purity/no-system-clock`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

Une règle qui lit l'horloge donne une réponse différente à chaque exécution. Le temps est une entrée : le domaine le reçoit, l'application le prend au port `Clock`, un test le fixe avec `FixedClock`.

## Signalé

- `new Date()` sans argument
- `Date.now`, `Date()`
- `performance.now`, `performance.timeOrigin`
- les mêmes par `globalThis`, `window`, `self` ou `global`

Incorrect :

```ts
const overdue = invoice.dueAt < new Date();
const started = Date.now();
```

Correct :

```ts
const overdue = invoice.isOverdue(this.clock.now());
const due = new Date(issuedAt.getTime() + 30 * DAY);
```

## Détails

`new Date(value)` construit une date à partir de données et est permis.

## Options

Aucune.

`rules."purity/no-system-clock"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line purity/no-system-clock -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une enveloppe autour de l'accès interdit (un auxiliaire de la plateforme qui appelle `Date.now()`) n'est pas vue ici ; les règles de couche arrêtent l'import de cet auxiliaire.
- Une déclaration locale qui masque la globale (`const process = ...`) n'est pas signalée.

## Avec le checker de la CLI

`ddd-ts-kit check` cherche les mêmes noms avec des expressions régulières. Cette règle fait autorité : elle distingue un nom masqué de la globale, et du code d'une chaîne.
