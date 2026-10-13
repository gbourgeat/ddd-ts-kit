[English](context-published-language-is-a-contract.md) · **Français**
<!-- translation-of: context-published-language-is-a-contract.md sha256:50d3ff798fb2a0b3 -->

# ddd-ts-kit/context-published-language-is-a-contract

Identifiant d'architecture : `context/published-language-is-a-contract`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `published-language/` d'un contexte, tests exclus.

## Pourquoi

Ce qu'un contexte publie doit être sérialisable et stable. Un contrat qui importe le domaine expose le modèle interne sous un autre nom.

## Signalé

- tout import autre que `publishedLanguageAllowedPackages` (par défaut : le *kernel*, `@ddd-ts-kit/events`, `@ddd-ts-kit/validation` et la bibliothèque de schémas de `stack.validation`) et les autres langages publiés

Incorrect :

```ts
// src/contexts/billing/published-language/invoice-issued.v1.integration-event.ts
import type { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
```

Correct :

```ts
import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import { z } from 'zod';
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques, `require()`, `import x = require()` et les types `import("...")` sont tous lus, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune. `publishedLanguageAllowedPackages` dans `ddd-ts-kit.config.json` remplace la liste des imports permis.

`rules."context/published-language-is-a-contract"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line context/published-language-is-a-contract -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La cible est classée d'après son chemin : un *barrel* d'une couche permise qui réexporte une couche interdite n'est pas suivi. `dependency-cruiser` (voir `pipeline/depcruise-config.mjs`) résout le vrai graphe et comble ce manque.
- Un spécificateur calculé (`import(name)`) n'est pas jugé.
- Les chemins `tsconfig` autres que `importAlias` ne sont pas résolus.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir d'une lecture du fichier par expressions régulières. Cette règle fait autorité pour l'import ; la CLI reste l'autorité pour la configuration (`config/valid`, `context/no-cycle`).
