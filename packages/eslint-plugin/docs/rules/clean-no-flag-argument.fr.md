[English](clean-no-flag-argument.md) · **Français**
<!-- translation-of: clean-no-flag-argument.md sha256:4d4e6f6c264f1c0d -->

# ddd-ts-kit/clean-no-flag-argument

Identifiant d'architecture : `clean/no-flag-argument`. Sévérité par défaut : `warn` dans `recommended`, `error` dans `strict`.

S'applique à : les méthodes publiques des classes de `domain/`, et `execute` dans `application/` ; tests exclus.

## Pourquoi

Un paramètre booléen dit que la méthode fait deux choses. L'appel se lit `close(true)` et personne ne sait ce qui est vrai.

## Signalé

- un paramètre typé `boolean` (aussi `boolean | undefined`, ou booléen facultatif comme `force?: boolean`) ou dont la valeur par défaut est `true` ou `false`

Incorrect :

```ts
class Invoice {
  close(force: boolean): void {}
}
```

Correct :

```ts
class Invoice {
  close(): void {}
  forceClose(reason: string): void {}
}
```

## Détails

Les classes nommées `...Command` ou `...Query` sont des messages et transportent des données : elles sont exemptées. Les méthodes privées et les constructeurs sont exemptés.

## Options

Aucune.

`rules."clean/no-flag-argument"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/no-flag-argument -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Le type est lu dans l'annotation, pas inféré : `flag = isReady()` n'est pas vu.
- Les fonctions hors des classes ne sont pas jugées.
- Quand le fichier ne relève d'aucune couche connue de `ddd-ts-kit.config.json` (un fichier hors d'un contexte), la règle se tait.

## Avec le checker de la CLI

`ddd-ts-kit check` approche cette règle sur le texte du fichier et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
