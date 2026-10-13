[English](governance-recorded-deviation.md) · **Français**
<!-- translation-of: governance-recorded-deviation.md sha256:b6bd3d82e8036f02 -->

# ddd-ts-kit/governance-recorded-deviation

Identifiant d'architecture : `governance/recorded-deviation`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

L'architecture peut être changée délibérément, pas contournée au cas par cas. Une désactivation est soit refusée, soit enregistrée comme une décision, avec sa raison, sa portée et la condition de son retrait. Un raccourci qui n'est pas écrit est un défaut, quel que soit celui qui l'a demandé.

## Signalé

- `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` et `ddd-ts-kit-disable-next-line` dont la raison après `--` ne contient aucun `ADR-<digits>`
- les mêmes commentaires quand ils ne nomment aucune règle, quoi qui suive `--`

Incorrect :

```ts
/* eslint-disable */
// eslint-disable-next-line no-console -- la CLI affiche son résultat
console.log(result);
```

Correct :

```ts
// eslint-disable-next-line no-console -- ADR-0012 : la CLI affiche son résultat
console.log(result);
```

## Détails

Enregistrez la décision avec `ddd-ts-kit generate adr`, puis citez son numéro.

ESLint écarte un signalement fait à l'intérieur de la portée d'une directive qui couvre sa règle, si bien qu'un `/* eslint-disable */` global ferait taire la règle même qui le juge. Un tel commentaire (global, ou nommant `ddd-ts-kit/governance-recorded-deviation` sans enregistrement de décision) est donc signalé avant la portée qu'il ouvre : à la première position du fichier pour `eslint-disable`, sur la ligne du dessus pour `eslint-disable-line`. Le message donne toujours la ligne du commentaire.

`clean/no-escape-hatch` signale un `eslint-disable` sans aucune raison ; cette règle en demande davantage à la raison. Avec les deux activées, un commentaire sans aucune raison est signalé deux fois.

## Options

Aucune.

`rules."governance/recorded-deviation"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line governance/recorded-deviation -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Que `docs/adr/` contienne l'enregistrement nommé n'est pas vérifié ici : `ddd-ts-kit check` le fait.
- Les autres dérogations à la référence d'architecture (une sévérité abaissée, un répertoire supplémentaire, un *package* autorisé supplémentaire dans `ddd-ts-kit.config.json`) ne sont pas des sources : `ddd-ts-kit check` les juge.
- Une désactivation écrite dans la configuration d'ESLint (`rules: { ...: 'off' }`, `ignores`) ou sur la ligne de commande est hors de portée de toute règle.
- Le signalement placé avant une désactivation globale repose sur l'ordre dans lequel ESLint applique les directives ; `// eslint-disable-next-line ddd-ts-kit/governance-recorded-deviation` écrit sur la ligne au-dessus d'un commentaire fait encore taire son signalement.
- `@ts-expect-error` et `@ts-ignore` sont tenus par `@typescript-eslint/ban-ts-comment`.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant pour les désactivations et pour la configuration, et vérifie que l'enregistrement de décision existe. Cette règle fait autorité pour les commentaires que comprend ESLint.
