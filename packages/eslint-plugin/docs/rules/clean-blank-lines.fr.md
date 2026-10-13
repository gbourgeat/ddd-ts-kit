[English](clean-blank-lines.md) · **Français**
<!-- translation-of: clean-blank-lines.md sha256:1e34d962b9373936 -->

# clean/blank-lines (mise en page)

Identifiant d'architecture : `clean/blank-lines`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`. Corrigeable avec `--fix`.

S'applique à : chaque fichier TypeScript passé au lint.

Ce n'est pas une règle de ce *plugin* : deux règles de [`@stylistic/eslint-plugin`](https://eslint.style) la tiennent, configurées par les préréglages et exportées sous `standardRules.layout`.

## Pourquoi

Une fonction se lit en paragraphes : ce qu'elle déclare, ce qu'elle décide, ce qu'elle répond. Une ligne vide avant chaque `return` et entre les blocs logiques rend ces paragraphes visibles, et donne à un bloc qui en a trop accumulé l'air de ce qu'il est : une fonction à découper.

## Signalé

- un `return` qui n'est pas seul dans son bloc et n'est pas précédé d'une ligne vide
- pas de ligne vide après un groupe de déclarations (`const`, `let`), ou autour d'un `if`, d'un `for`, d'un `while`, d'un `do`, d'un `try`, d'un `switch` ou d'un bloc
- pas de ligne vide autour d'une instruction ou d'une déclaration écrite sur plusieurs lignes
- pas de ligne vide avant ou après une méthode d'une classe

Incorrect :

```ts
function total(lines: readonly Line[]): number {
  const amounts = lines.map((line) => line.amount);
  if (amounts.length === 0) {
    return 0;
  }
  return amounts.reduce((sum, amount) => sum + amount, 0);
}
```

Correct :

```ts
function total(lines: readonly Line[]): number {
  const amounts = lines.map((line) => line.amount);

  if (amounts.length === 0) {
    return 0;
  }

  return amounts.reduce((sum, amount) => sum + amount, 0);
}
```

## Détails

Ce qui peut rester groupé : des déclarations d'une ligne consécutives ; des étiquettes `case` consécutives ; des champs consécutifs d'une classe, et des signatures abstraites consécutives d'un port ; les surcharges d'une méthode.

```js
'@stylistic/padding-line-between-statements': [level,
  { blankLine: 'always', prev: '*', next: 'return' },
  { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
  { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
  { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'do', 'try', 'switch', 'block-like'] },
  { blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'try', 'switch', 'block-like'], next: '*' },
  { blankLine: 'always', prev: '*', next: ['multiline-const', 'multiline-let', 'multiline-var', 'multiline-expression'] },
  { blankLine: 'always', prev: ['multiline-const', 'multiline-let', 'multiline-var', 'multiline-expression'], next: '*' },
  { blankLine: 'any', prev: ['case', 'default'], next: ['case', 'default'] },
],
'@stylistic/lines-between-class-members': [level, { enforce: [
  { blankLine: 'always', prev: '*', next: 'method' },
  { blankLine: 'always', prev: 'method', next: '*' },
] }, { exceptAfterOverload: true }],
```

`dddTsKit()` et les deux préréglages enregistrent le *plugin* sous `@stylistic` et activent les deux règles. Une ligne vide juste après `{` ou juste avant `}`, deux lignes vides de suite et une ligne vide à la fin d'un fichier sont retirées par le formateur ([`clean/formatted`](clean-formatted.fr.md)), pas signalées ici. Dans une configuration composée à la main :

```js
import stylistic from '@stylistic/eslint-plugin';
import { standardRules } from '@ddd-ts-kit/eslint-plugin';

export default [{ files: ['**/*.ts'], plugins: { '@stylistic': stylistic }, rules: standardRules.layout }];
```

## Options

Aucune. `rules."clean/blank-lines"` dans `ddd-ts-kit.config.json` donne leur sévérité aux deux règles dans `dddTsKit()` : `error` (par défaut), `warn`, ou `off`, qui les laisse de côté. Le commentaire `ddd-ts-kit-disable-next-line` n'atteint pas ces règles : ce ne sont pas des règles de ce *plugin*, et toutes deux sont corrigées par `eslint --fix --fix-type layout`.

## Limites

- Les règles jugent les lignes vides, pas les retours à la ligne, l'indentation ou la longueur des lignes : c'est le formateur du projet qui s'en charge, et il garde les lignes vides qu'il trouve.
- Une ligne vide exigée des deux côtés d'une instruction sur plusieurs lignes s'applique aussi à l'intérieur d'un groupe de déclarations : une `const` écrite sur plusieurs lignes est séparée des `const` d'une ligne qui l'entourent.

## Avec le checker de la CLI

`ddd-ts-kit check` ne tient que la partie peu coûteuse, comme une approximation : un `return` collé à l'instruction au-dessus de lui, et un bloc d'instructions rembourré de lignes vides. Il laisse tranquilles les accolades qui ne contiennent aucune instruction : un littéral d'objet, un littéral de type, une interface, un enum, un motif de déstructuration, une liste d'imports ou d'exports. Ces règles font autorité.
