[English](layer-infrastructure-no-presentation.md) · **Français**
<!-- translation-of: layer-infrastructure-no-presentation.md sha256:b7e06c69f41cb0cb -->

# ddd-ts-kit/layer-infrastructure-no-presentation

Identifiant d'architecture : `layer/infrastructure-no-presentation`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `infrastructure/` d'un contexte, tests exclus.

## Pourquoi

Les adaptateurs implémentent des ports de l'application et du domaine. Un adaptateur qui connaît un DTO du transport couple la persistance à HTTP : le type partagé appartient à l'application.

## Signalé

- un import de `presentation/` du même contexte

Incorrect :

```ts
// src/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.ts
import type { IssueInvoiceBody } from '@/contexts/billing/presentation/http/issue-invoice.dto';
```

Correct :

```ts
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques, `require()`, `import x = require()` et les types `import("...")` sont tous lus, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune.

`rules."layer/infrastructure-no-presentation"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line layer/infrastructure-no-presentation -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La cible est classée d'après son chemin : un *barrel* d'une couche permise qui réexporte une couche interdite n'est pas suivi. `dependency-cruiser` (voir `pipeline/depcruise-config.mjs`) résout le vrai graphe et comble ce manque.
- Un spécificateur calculé (`import(name)`) n'est pas jugé.
- Les chemins `tsconfig` autres que `importAlias` ne sont pas résolus.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir d'une lecture du fichier par expressions régulières, assez rapide pour un *hook* d'éditeur. Cette règle fait autorité : elle lit l'arbre syntaxique.
