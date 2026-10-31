[English](layer-domain-purity.md) · **Français**
<!-- translation-of: layer-domain-purity.md sha256:bba4b3cedef2b3ae -->

# ddd-ts-kit/layer-domain-purity

Identifiant d'architecture : `layer/domain-purity`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` d'un contexte, tests exclus.

## Pourquoi

Le domaine est la partie du système qui doit survivre à un changement de framework, d'ORM ou de transport. Chaque import vers l'extérieur lie une règle métier à une décision technique et la rend impossible à tester sans cette technologie.

## Signalé

- un *package* hors de `domainAllowedPackages` (par défaut : `@ddd-ts-kit/kernel`)
- un point d'entrée d'un *package* autorisé du kit qui contient un adaptateur, le câblage d'un conteneur ou des doublures de test (`@ddd-ts-kit/kernel/testing`, `@ddd-ts-kit/auth/jwt`, `/passport`, `/rebac`, `/di`, `/testing`), sauf si `domainAllowedPackages` nomme ce point d'entrée lui-même
- `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/s3`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` et `@ddd-ts-kit/tracing`, par n'importe quelle entrée (`.`, `/decorators`, `/testing`, `/node`, ...), avec un message propre : ils appliquent ou enregistrent une préoccupation depuis l'extérieur du modèle
- dans un projet de style déclaré (`stack.style: "declared"`) : `@ddd-ts-kit/kernel/declarations`, même si `@ddd-ts-kit/kernel` est permis, avec un message propre : le domaine ne déclare rien
- tout module natif de Node
- une autre couche du même contexte, la plateforme, `main.ts`
- le langage publié d'un autre contexte (traduisez-le dans un gestionnaire d'événement d'intégration ou dans une couche anticorruption)

Incorrect :

```ts
// src/contexts/billing/domain/aggregates/invoice.aggregate.ts
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Logged } from '@ddd-ts-kit/aspects/decorators';
import type { InvoiceRow } from '@/contexts/billing/infrastructure/persistence/billing.schema';
```

Correct :

```ts
// src/contexts/billing/domain/aggregates/invoice.aggregate.ts
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import type { Amount } from '@/contexts/billing/domain/value-objects/amount.vo';
import { Money } from '@/shared-kernel/money.vo';
```

## Détails

Les agrégats, les entités, les objets-valeurs, les événements, les services et les ports de *repository* ne portent ni décorateur ni liste de dépendances : le décorateur se place sur la classe de `application/` ou de `infrastructure/` qui joue un rôle, et un port est une classe abstraite de `domain/repositories/` ou de `application/ports/`. Le refus de l'entrée des déclarations tient même quand `domainAllowedPackages` la nomme. Un projet de style explicite est jugé comme avant : l'entrée y fait partie de `@ddd-ts-kit/kernel`. Un décorateur porté malgré tout par une classe de `domain/` est signalé par `declarations-role-declared`.

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques, `require()`, `import x = require()` et les types `import("...")` sont tous lus, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune. `domainAllowedPackages` dans `ddd-ts-kit.config.json` étend la liste autorisée. Les sept *packages* ci-dessus restent refusés quoi que dise la liste, même quand elle les nomme : la journalisation, les métriques, les nouvelles tentatives (retry), le délai d'expiration (timeout), le disjoncteur (circuit breaker), le cache et le traçage atteignent le modèle depuis la racine de composition (`.with(...)` sur une liaison, le *hook* `decorate`), un *middleware* du bus ou un adaptateur dans `infrastructure/` ; Redis se trouve derrière un port, un stockage d'objets derrière le port `FileStorage` du noyau, le planificateur derrière le port `JobScheduler` et le signalement des erreurs derrière le port `ErrorReporter` ; le journal d'audit est alimenté par le *middleware* du bus, le *hook* d'autorisation et un abonnement aux événements. Le seul moyen de passer outre est une désactivation enregistrée de la ligne.

`rules."layer/domain-purity"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line layer/domain-purity -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La cible est classée par son chemin : un *barrel* dans une couche permise qui réexporte une couche interdite n'est pas suivi. `dependency-cruiser` (voir `pipeline/depcruise-config.mjs`) résout le vrai graphe et comble ce manque.
- Un spécificateur calculé (`import(name)`) n'est pas jugé.
- Les chemins de `tsconfig` autres que `importAlias` ne sont pas résolus.
- Les éléments internes d'un autre contexte sont laissés à `context-published-language-only`, pour qu'un import donne un seul signalement.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir d'une lecture du fichier par expressions régulières, assez rapide pour un *hook* d'éditeur. Cette règle fait autorité : elle lit l'arbre syntaxique.
