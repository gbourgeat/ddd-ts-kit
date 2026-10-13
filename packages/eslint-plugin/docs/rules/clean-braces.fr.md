[English](clean-braces.md) · **Français**
<!-- translation-of: clean-braces.md sha256:b248a2e4bde32e6b -->

# clean/braces (mise en page)

Identifiant d'architecture : `clean/braces`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`. Corrigeable avec `--fix`.

S'applique à : chaque fichier TypeScript passé au lint, et dans `dddTsKit()` chaque fichier `.js`, `.mjs` et `.cjs` passé au lint.

Ce n'est pas une règle de ce *plugin* : `curly` d'ESLint la tient, configurée par les *presets* et exportée sous le nom `standardRules.braces`.

## Pourquoi

Une branche écrite entre accolades, son corps sur ses propres lignes, se voit d'un coup d'œil, et une instruction qu'on y ajoute plus tard ne peut pas se retrouver en dehors sans que personne le voie.

## Signalé

- un `if`, un `else`, un `for`, un `for..of`, un `for..in`, un `while` ou un `do` dont le corps n'est pas un bloc

Incorrect :

```ts
if (wrapped.has(repository)) return repository;

for (const step of steps) await step();
```

Correct :

```ts
if (wrapped.has(repository)) {
  return repository;
}

for (const step of steps) {
  await step();
}
```

## Détails

```js
curly: [level, 'all'],
```

Ne sont pas jugés : un ternaire, une fonction fléchée qui renvoie une expression, les expressions `??` et `&&`, un littéral d'objet sur une ligne. Une chaîne `else if` reste `} else if (...) {` sur la ligne de l'accolade fermante.

`curly` ajoute les accolades ; leur place est l'affaire du formateur ([`clean/formatted`](clean-formatted.fr.md)), qui coupe toujours un bloc contenant une instruction : `if (a) { return b; }` sur une ligne ne survit pas à `npm run format`, et `npm run format:check` le refuse. C'est pourquoi `@stylistic/brace-style` n'est pas activée : elle ne ferait que répéter ce que décide le formateur.

Dans une configuration composée à la main :

```js
import { standardRules } from '@ddd-ts-kit/eslint-plugin';

export default [{ files: ['**/*.ts'], rules: standardRules.braces }];
```

## Options

Aucune. `rules."clean/braces"` dans `ddd-ts-kit.config.json` donne sa sévérité à `curly` dans `dddTsKit()` : `error` (par défaut), `warn`, ou `off`, qui la retire. Le commentaire `ddd-ts-kit-disable-next-line` ne l'atteint pas : ce n'est pas une règle de ce *plugin*.

## Avec le checker de la CLI

`ddd-ts-kit check` tient la même chose sur le texte, par approximation : un corps sans accolades, un corps sur la ligne de ses accolades, un `else` sur une ligne à lui seul. Cette règle et le formateur font autorité.
