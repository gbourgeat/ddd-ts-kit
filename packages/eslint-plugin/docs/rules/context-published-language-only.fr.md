[English](context-published-language-only.md) · **Français**
<!-- translation-of: context-published-language-only.md sha256:93aad82bcfae1b9a -->

# ddd-ts-kit/context-published-language-only

Identifiant d'architecture : `context/published-language-only`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier d'un contexte, tests compris.

## Pourquoi

Un contexte délimité (bounded context) possède son modèle. Un autre contexte qui importe son agrégat ou sa table fige ce modèle : le langage publié est le seul contrat conçu pour qu'on en dépende.

## Signalé

- un import d'un autre contexte hors de son `published-language/`

Incorrect :

```ts
// src/contexts/billing/application/...
import { Product } from '@/contexts/catalog/domain/aggregates/product.aggregate';
```

Correct :

```ts
import type { ProductListedV1 } from '@/contexts/catalog/published-language/index';
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques, `require()`, `import x = require()` et les types `import("...")` sont tous lus, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune.

`rules."context/published-language-only"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line context/published-language-only -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La cible est classée d'après son chemin : un *barrel* d'une couche permise qui réexporte une couche interdite n'est pas suivi. `dependency-cruiser` (voir `pipeline/depcruise-config.mjs`) résout le vrai graphe et comble ce manque.
- Un spécificateur calculé (`import(name)`) n'est pas jugé.
- Les chemins `tsconfig` autres que `importAlias` ne sont pas résolus.
- Les fichiers hors du répertoire des contextes (la plateforme, `main.ts`) ne sont pas jugés : la racine de composition connaît chaque contexte.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir d'une lecture du fichier par expressions régulières. Cette règle fait autorité pour l'import ; la CLI reste l'autorité pour la configuration (`config/valid`, `context/no-cycle`).
