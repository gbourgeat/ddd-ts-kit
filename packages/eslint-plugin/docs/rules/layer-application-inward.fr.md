[English](layer-application-inward.md) · **Français**
<!-- translation-of: layer-application-inward.md sha256:03b6d93f13ce9469 -->

# ddd-ts-kit/layer-application-inward

Identifiant d'architecture : `layer/application-inward`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `application/` d'un contexte, tests exclus.

## Pourquoi

Les cas d'usage orchestrent le domaine par des ports. Un import d'un adaptateur, d'un pilote ou d'un framework rend le cas d'usage impossible à exécuter avec des *fakes* et déplace une décision technique dans l'application.

## Signalé

- un *package* hors de `applicationAllowedPackages`
- `@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/s3`, `@ddd-ts-kit/scheduling`, `@ddd-ts-kit/sentry` et `@ddd-ts-kit/tracing`, par n'importe quelle entrée (`.`, `/decorators`, `/testing`, `/node`, ...), avec un message propre : ils appliquent ou enregistrent une préoccupation depuis l'extérieur des cas d'usage
- tout module natif de Node
- `infrastructure/`, `presentation/` ou le fichier de module du même contexte
- la plateforme ou `main.ts`

Incorrect :

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { eq } from 'drizzle-orm';
import { retry } from '@ddd-ts-kit/aspects';
import { RedisCache } from '@ddd-ts-kit/redis';
import { DrizzleInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository';
```

Correct :

```ts
// un port est une classe abstraite : le type de la dépendance et son jeton d'injection
import { Cache, Clock } from '@ddd-ts-kit/kernel';
import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';
import { PaymentGateway } from '@/contexts/billing/application/ports/payment-gateway.port';

// style déclaré
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, PaymentGateway, Clock])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {}
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques, `require()`, `import x = require()` et les types `import("...")` sont tous lus, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune. `applicationAllowedPackages` dans `ddd-ts-kit.config.json` remplace la liste autorisée, qui vaut par défaut `@ddd-ts-kit/kernel` et `@ddd-ts-kit/auth` (les permissions et les politiques se déclarent dans `application/authorization/`). Dans un projet de style déclaré (`stack.style: "declared"`), `@ddd-ts-kit/kernel/declarations` est permis quoi que dise la liste : un gestionnaire, un consommateur ou une politique dit ce qu'il est par un décorateur de cette entrée, qui n'est que des métadonnées. Dans un projet de style explicite, l'entrée est permise comme le reste de `@ddd-ts-kit/kernel`, par la liste. Les sept *packages* énumérés sous « Signalé » restent refusés quoi que dise la liste autorisée, même quand elle les nomme : un aspect s'applique à la racine de composition (`.with(...)` sur une liaison, le *hook* `decorate`), dans un *middleware* du bus ou sur un adaptateur dans `infrastructure/` ; un cas d'usage dépend du port (`Cache` ou `FileStorage` du noyau, un port dans `application/ports/`) et la plateforme lie l'adaptateur Redis ou S3 ; un job déclare son horaire par `@Scheduled` et la racine de composition lie le planificateur ; les échecs sont signalés par le *middleware* du bus, le *mapper* d'erreurs HTTP et l'exécuteur des jobs ; le journal d'audit est alimenté par le *middleware* du bus, le *hook* d'autorisation et un abonnement aux événements, jamais par un cas d'usage. Le seul moyen de passer outre est une désactivation enregistrée de la ligne.

`rules."layer/application-inward"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line layer/application-inward -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La cible est classée par son chemin : un *barrel* dans une couche permise qui réexporte une couche interdite n'est pas suivi. `dependency-cruiser` (voir `pipeline/depcruise-config.mjs`) résout le vrai graphe et comble ce manque.
- Un spécificateur calculé (`import(name)`) n'est pas jugé.
- Les chemins de `tsconfig` autres que `importAlias` ne sont pas résolus.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir d'une lecture du fichier par expressions régulières, assez rapide pour un *hook* d'éditeur. Cette règle fait autorité : elle lit l'arbre syntaxique.
