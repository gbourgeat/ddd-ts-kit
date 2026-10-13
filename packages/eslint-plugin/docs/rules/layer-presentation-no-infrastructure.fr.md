[English](layer-presentation-no-infrastructure.md) · **Français**
<!-- translation-of: layer-presentation-no-infrastructure.md sha256:9e36510c520ef7cc -->

# ddd-ts-kit/layer-presentation-no-infrastructure

Identifiant d'architecture : `layer/presentation-no-infrastructure`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `presentation/` d'un contexte, tests exclus.

## Pourquoi

Une route traduit une requête HTTP en commande ou en requête, et un résultat en réponse. Quand elle atteint directement un adaptateur, le cas d'usage est contourné, et avec lui ses règles, son unité de travail et son autorisation.

## Signalé

- un import de `infrastructure/` du même contexte

Incorrect :

```ts
// src/contexts/billing/presentation/http/issue-invoice.route.ts
import { DrizzleInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository';
```

Correct :

```ts
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques, `require()`, `import x = require()` et les types `import("...")` sont tous lus, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune.

`rules."layer/presentation-no-infrastructure"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line layer/presentation-no-infrastructure -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La cible est classée d'après son chemin : un *barrel* d'une couche permise qui réexporte une couche interdite n'est pas suivi. `dependency-cruiser` (voir `pipeline/depcruise-config.mjs`) résout le vrai graphe et comble ce manque.
- Un spécificateur calculé (`import(name)`) n'est pas jugé.
- Les chemins `tsconfig` autres que `importAlias` ne sont pas résolus.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir d'une lecture du fichier par expressions régulières, assez rapide pour un *hook* d'éditeur. Cette règle fait autorité : elle lit l'arbre syntaxique.
