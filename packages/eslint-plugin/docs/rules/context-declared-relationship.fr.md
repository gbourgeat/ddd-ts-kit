[English](context-declared-relationship.md) · **Français**
<!-- translation-of: context-declared-relationship.md sha256:87f6d7e6f1f3ab53 -->

# ddd-ts-kit/context-declared-relationship

Identifiant d'architecture : `context/declared-relationship`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier d'un contexte, tests compris.

## Pourquoi

Les relations entre contextes sont des décisions stratégiques écrites dans `ddd-ts-kit.config.json` et dessinées sur la carte des contextes. Un import ne doit jamais être le seul endroit où une dépendance existe.

## Signalé

- un import du langage publié d'un contexte qui n'est pas listé dans `contexts.<this context>.upstreams`

Incorrect :

```ts
// ddd-ts-kit.config.json: "shipping": { "upstreams": [] }
// src/contexts/shipping/application/integration/handlers/billing-invoice-issued.integration-handler.ts
import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language';
```

Correct :

```ts
// ddd-ts-kit.config.json: "shipping": { "upstreams": [{ "context": "billing", "relationship": "published-language" }] }
import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language';
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques, `require()`, `import x = require()` et les types `import("...")` sont tous lus, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune.

`rules."context/declared-relationship"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line context/declared-relationship -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La cible est classée d'après son chemin : un *barrel* d'une couche permise qui réexporte une couche interdite n'est pas suivi. `dependency-cruiser` (voir `pipeline/depcruise-config.mjs`) résout le vrai graphe et comble ce manque.
- Un spécificateur calculé (`import(name)`) n'est pas jugé.
- Les chemins `tsconfig` autres que `importAlias` ne sont pas résolus.
- Les cycles entre relations déclarées sont trouvés par `ddd-ts-kit check` (`context/no-cycle`), qui lit toute la configuration.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir d'une lecture du fichier par expressions régulières. Cette règle fait autorité pour l'import ; la CLI reste l'autorité pour la configuration (`config/valid`, `context/no-cycle`).
