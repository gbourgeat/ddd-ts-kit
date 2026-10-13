[English](domain-no-generic-error.md) · **Français**
<!-- translation-of: domain-no-generic-error.md sha256:49dbe62589dd0c83 -->

# ddd-ts-kit/domain-no-generic-error

Identifiant d'architecture : `domain/no-generic-error` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

Un échec métier attendu a un nom et un code stable que la présentation fait correspondre à un statut, en un seul endroit. `new Error("...")` donne à l'appelant une phrase à analyser.

## Signalé

- `throw new Error(...)` et `throw Error(...)`

Incorrect :

```ts
throw new Error('Invoice already issued');
```

Correct :

```ts
throw new InvoiceAlreadyIssued(this.id);
```

## Options

Aucune.

`rules."domain/no-generic-error"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line domain/no-generic-error -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Seul l'`Error` global est signalé : `TypeError` et consorts sont laissés à la revue.
- Une erreur générique renvoyée dans un `Result` (`err(new Error())`) ou rejetée (`Promise.reject`) n'est pas vue.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car la forme d'une classe demande un arbre syntaxique.
