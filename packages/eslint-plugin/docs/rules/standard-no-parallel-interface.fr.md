[English](standard-no-parallel-interface.md) · **Français**
<!-- translation-of: standard-no-parallel-interface.md sha256:da89e58ddf2a5df6 -->

# ddd-ts-kit/standard-no-parallel-interface

Identifiant d'architecture : `standard/no-parallel-interface`. Sévérité par défaut : `warn` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier de production sous la racine des sources ; tests exclus.

## Pourquoi

Le noyau définit les formes que partagent tous les projets (`Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`, `Page` et `PageRequest`, `AuditStamp`, `Clock`, `IdGenerator`, `UnitOfWork`, `JobScheduler`, `ScheduledJob`, `ErrorReporter`), pour qu'un adaptateur, un *middleware* ou un tableau de bord écrit une fois leur convienne à tous. Un `ILogger` ou un `UserContext` maison à côté d'elles crée une bifurcation de la forme : chaque adaptateur a besoin d'une traduction, et les champs du projet n'atteignent jamais les lignes de journal, les *spans* et les entrées d'audit standard.

## Signalé

Une classe, une interface ou un alias de type déclaré sous l'un de ces noms :

| Nom déclaré | À utiliser à la place |
|---|---|
| `ILogger`, `AppLogger`, `LoggerService`, `LoggerInterface` | `Logger` |
| `IMetrics`, `MetricsService` | `Metrics` |
| `ICache`, `CacheService` | `Cache` |
| `UserContext`, `CurrentUser`, `AuthContext`, `RequestContext` (hors de `presentation/` et de la plateforme), `IExecutionContext`, `IActor` | `ExecutionContext` ou `Actor` |
| `UserSession`, `AuthSession`, `SessionData`, `ISession` | `Session` |
| `PaginatedResult`, `PageResult`, `PaginatedResponse`, `Paginated`, `IPage` | `Page` |
| `PaginationParams`, `PageParams`, `IPageRequest` | `PageRequest` |
| `AuditLog`, `AuditLogEntry`, `AuditRecord`, `IAuditEntry` | `AuditEntry` de `@ddd-ts-kit/audit` (`AuditStamp`, ainsi que `IAuditStamp`, pour les colonnes d'audit) |
| `IClock`, `IIdGenerator`, `IUnitOfWork` | `Clock`, `IdGenerator`, `UnitOfWork` |
| `IJobScheduler`, `JobSchedulerService`, `CronScheduler`, `TaskScheduler` | `JobScheduler` |
| `IScheduledJob`, `CronJob`, `ScheduledTask`, `BackgroundJob` | `ScheduledJob` |
| `IErrorReporter`, `ErrorReporterService`, `ErrorTracker`, `ExceptionReporter`, `CrashReporter` | `ErrorReporter` |
| `ICacheInvalidation`, `CacheInvalidator`, `CacheInvalidationService` | `CacheInvalidation` |
| `ICachePurger`, `CachePurgeService`, `CdnPurger` | `CachePurger` |

Incorrect :

```ts
// src/contexts/billing/application/ports/logger.port.ts
export interface ILogger {
  info(message: string): void;
}

// src/shared-kernel/user-context.ts
export interface UserContext {
  userId: string;
  tenantId: string;
  plan: string;
}
```

Correct :

```ts
import type { ExecutionContext, Logger } from '@ddd-ts-kit/kernel';

// src/platform/kernel-extensions.ts
declare module '@ddd-ts-kit/kernel' {
  interface ExecutionContextExtensions {
    plan: string;
  }
}

// src/contexts/billing/infrastructure/external/pino.logger.ts
export class PinoLogger implements Logger {}
```

## Détails

La correspondance porte sur le nom déclaré entier, sensible à la casse, comparé à une table explicite : les noms ci-dessus, et `I` suivi d'un nom standard. Rien n'est déduit d'un mot à l'intérieur d'un nom, si bien que `StdoutLogger`, `RedisCache`, `UserSessionPolicy`, `PageLayout` et `FakeLogger` ne sont pas signalés, pas plus que les noms du noyau eux-mêmes, leurs imports ou leurs usages.

Une classe qui `implements` ou `extends` l'interface qu'elle remplacerait (`class CacheService implements Cache`) est une implémentation, pas une seconde interface, et n'est pas signalée ; nommez-la tout de même d'après sa technologie. Une interface qui `extends` celle du noyau, et un alias de type de celle-ci, sont signalés : les interfaces du noyau s'étendent par fusion de déclarations de `SessionExtensions`, `ExecutionContextExtensions`, `ActorExtensions`, `LogFields` et `MetricLabels`, pas par un sous-type sous un autre nom.

`RequestContext` est le contexte d'une requête de transport : `presentation/` d'un contexte et la plateforme peuvent en déclarer un.

## Options

Aucune. La table se change par `standardInterfaces` dans `ddd-ts-kit.config.json`, fusionné par-dessus les valeurs par défaut : une chaîne ajoute un nom ou remplace ce qu'il faut utiliser à la place, `false` retire une entrée par défaut.

```json
{
  "standardInterfaces": {
    "TenantInfo": "TenantScoped",
    "CurrentUser": false
  }
}
```

`rules."standard/no-parallel-interface"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line standard/no-parallel-interface -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un concept du domaine qui porte l'un de ces noms pour une bonne raison (un agrégat `AuditLog` dans un contexte d'audit, un modèle de lecture `CurrentUser` d'un contexte d'identité dont le glossaire définit le terme) est signalé : le glossaire n'est pas lu. Retirez l'entrée dans `standardInterfaces`, ou enregistrez la désactivation de la ligne.
- Une forme parallèle sous un nom que la table ne contient pas (`LogService`, `Pagination`, `Principal`) n'est pas vue ; ajoutez-la à `standardInterfaces`.
- Une copie faite sans déclaration propre (un type objet en ligne, une réexportation sous un autre nom, `export { Logger as ILogger }`) n'est pas vue.
- Une expression de classe (`const ILogger = class {}`) et un enum ne sont pas jugés.
- L'exemption des classes lit les noms dans `implements` et `extends`, pas ce vers quoi ils se résolvent : une interface locale appelée `Logger` exempte aussi la classe.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir des déclarations qu'il lit dans le texte des fichiers, avec la même table (un test fixe l'accord entre les deux) et les mêmes exemptions. Cette règle fait autorité.
