[English](clean-function-ceiling.md) · **Français**
<!-- translation-of: clean-function-ceiling.md sha256:268afceea278fa7f -->

# ddd-ts-kit/clean-function-ceiling

Identifiant d'architecture : `clean/function-size`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint, tests et fichiers de module compris.

## Pourquoi

`clean/function-size` demande des fonctions courtes, avec une limite qu'un projet peut régler, et laisse tranquilles les fonctions de rappel de `describe` et les fichiers de module. Cette règle est la partie non négociable : au-delà de 100 lignes de code, une fonction est un fichier déguisé, quelle qu'elle soit, et une suite de tests de cette longueur teste plus d'une chose. ESLint donne une seule sévérité à un nom de règle, si bien que le plafond est une règle à part entière : une `error` tandis que `clean-function-size` reste un `warn`.

## Signalé

- une fonction, une méthode ou une fonction fléchée dont le corps contient plus de 100 lignes de code, fonctions de rappel de `describe`, `suite` et `context` et fonctions de `<context>.module.ts` comprises

Incorrect :

```ts
describe('an invoice', () => {
  // 140 lignes de tests sur l'émission, le paiement et l'annulation
});
```

Correct :

```ts
describe('an invoice being issued', () => {
  // les tests sur l'émission
});

describe('an invoice being paid', () => {
  // les tests sur le paiement
});
```

## Détails

Les lignes de code sont comptées comme `clean-function-size` les compte : les lignes du corps qui portent au moins un jeton ; les lignes vides et les lignes de commentaire ne sont pas comptées. Une fonction imbriquée compte dans la longueur de la fonction qui l'entoure.

Le même nombre plafonne la limite configurable : `limits.maxFunctionLines` de `ddd-ts-kit.config.json` et l'option `maxLines` de `clean-function-size` sont lus comme 100 quand ils sont plus élevés.

## Options

Aucune.

`rules."clean/function-size"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/function-size -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La règle ne peut pas être abaissée à un avertissement depuis `ddd-ts-kit.config.json` : seul `off` l'atteint, avec `clean/function-size` dans son ensemble.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le plafond sous `clean/function-size` avec la sévérité `error`, sur le texte du fichier : méthodes, déclarations de fonction à toute profondeur, expressions de fonction et fonctions fléchées, fonction fléchée en propriété de classe et fonction de rappel de `describe` ou de `it` comprises. Il ne lit pas les méthodes d'un littéral d'objet, et compte un littéral de gabarit écrit sur plusieurs lignes comme une seule ligne. Cette règle fait autorité.
