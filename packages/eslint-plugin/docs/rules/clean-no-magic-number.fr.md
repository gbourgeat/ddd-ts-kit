[English](clean-no-magic-number.md) · **Français**
<!-- translation-of: clean-no-magic-number.md sha256:8ee9e843edd7157c -->

# ddd-ts-kit/clean-no-magic-number

Identifiant d'architecture : `clean/no-magic-number`. Sévérité par défaut : `error`.

S'applique à : `domain/` et `application/` de chaque contexte d'un projet dont la configuration dit `"stack.literals": "named"`, ce qu'écrit `init` (une configuration qui ne dit rien, comme avant la 0.6, garde la règle silencieuse) ; tests exclus.

## Pourquoi

`hours * 60`, `limit = 100`, `padStart(2, '0')` : un nombre au milieu du modèle ne dit ni ce qu'il est ni qui l'a décidé. Sa deuxième copie dérive de la première, et une règle métier (une fenêtre de réservation, un délai de rappel, une limite de page) se cache dans une expression. Nommé une fois, il se lit comme le langage : `MINUTES_PER_HOUR`, `LONGEST_ADDRESS`, `BookingWindow.standard()`.

## Signalé

Un littéral nombre ou bigint, signe moins compris, qui n'est pas :

- 0, 1 ou -1 (configurable) ;
- un indice, `items[2]` ;
- un type, `type Hour = 7 | 8`, ou la valeur d'un membre d'enum ;
- dans l'initialiseur d'une constante du module (`const MINUTES_PER_HOUR = 60;`, un objet ou un tableau `as const` compris) ou d'un champ `static readonly`, sans fonction entre les deux.

Incorrect :

```ts
function minuteOf(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}
```

Correct :

```ts
const MINUTES_PER_HOUR = 60;

function minuteOf(hours: number, minutes: number): number {
  return hours * MINUTES_PER_HOUR + minutes;
}
```

## Détails

Une durée, un montant, une limite ou un taux du métier est mieux servi par un objet-valeur que par une constante (`BookingWindow`, `Money`) : la constante nomme le nombre, l'objet-valeur porte aussi ses règles.

## Options

`allow` : les nombres permis partout, `[0, 1, -1]` par défaut.

```js
'ddd-ts-kit/clean-no-magic-number': ['error', { allow: [0, 1, -1, 2] }]
```

`rules."clean/no-magic-number"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/no-magic-number -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une constante d'un corps de fonction, `const limit = 100` à l'intérieur de `execute`, est signalée : elle est nommée, mais décidée là où elle est utilisée.
- L'infrastructure, la présentation et la plateforme ne sont pas jugées : un numéro de port ou une taille de page d'une route relèvent de la configuration.

## Avec le checker de la CLI

Aucun : la règle a besoin d'un arbre syntaxique. `ddd-ts-kit check` connaît son identifiant pour que la configuration puisse fixer sa sévérité.
