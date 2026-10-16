[English](clean-function-size.md) · **Français**
<!-- translation-of: clean-function-size.md sha256:38b276d9ff8deece -->

# ddd-ts-kit/clean-function-size

Identifiant d'architecture : `clean/function-size`. Sévérité par défaut : `warn` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Une fonction à plus de trois paramètres cache un concept qui n'a pas encore de nom ; une fonction plus longue qu'un écran fait plus d'une chose.

## Signalé

- plus de `maxParameters` paramètres (3 par défaut) ; les constructeurs sont exemptés, un paramètre `this` n'est pas compté, ni un paramètre typé `Actor` ou `Date` (qui agit et quand : le contexte d'une intention)
- plus de `maxLines` lignes de code dans le corps (30 par défaut, jamais plus de 100) ; les lignes vides et les lignes de commentaire ne sont pas comptées

Incorrect :

```ts
function charge(amount: Amount, card: Card, at: Date, retries: number): void {}
```

Correct :

```ts
function charge(payment: Payment, policy: RetryPolicy): void {}
```

## Détails

Le fichier de module d'un contexte (`<context>.module.ts`) est exempté de la limite de lignes : une composition grandit avec le contexte. De même pour la fonction de rappel de `describe`, `suite` et `context` : elle contient des tests, pas des étapes. Tous deux restent tenus par le plafond strict de 100 lignes, qui est la règle compagne [`clean-function-ceiling`](clean-function-ceiling.fr.md), une `error` quelle que soit la sévérité de celle-ci.

## Options

`[{ "maxParameters": 3, "maxLines": 30 }]`. Quand une option est absente, `limits.maxParameters` et `limits.maxFunctionLines` de `ddd-ts-kit.config.json` s'appliquent, puis les valeurs par défaut. Un `maxLines` ou un `limits.maxFunctionLines` supérieur à 100 est lu comme 100.

`rules."clean/function-size"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/function-size -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Les règles standard `max-params` et `max-lines-per-function` ne sont pas activées par les *presets* : elles ne savent ni exempter les constructeurs ni lire les limites de la configuration, et signaleraient deux fois.
- Une fonction imbriquée compte dans la longueur de la fonction qui l'entoure.

## Avec le checker de la CLI

`ddd-ts-kit check` approche cette règle sur le texte du fichier et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
