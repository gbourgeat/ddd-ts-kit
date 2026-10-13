[English](aspects-outside-in.md) · **Français**
<!-- translation-of: aspects-outside-in.md sha256:7cfc6798c104eafe -->

# ddd-ts-kit/aspects-outside-in

Identifiant d'architecture : `aspects/outside-in`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier de production sous la racine des sources, sauf `infrastructure/` d'un contexte et le répertoire de la plateforme ; `domain/` et `application/` sont laissés aux règles de couche.

## Pourquoi

La journalisation, les métriques, les nouvelles tentatives (retry), le délai d'expiration (timeout), le disjoncteur (circuit breaker) et le cache s'appliquent depuis l'extérieur du code qu'ils enveloppent : la politique de toute une application se lit à un seul endroit, la racine de composition, et change sans toucher une classe. La forme décorateur est l'exception, gardée pour un adaptateur dont la politique fait partie de ce qu'est l'adaptateur (un client d'un fournisseur qui documente ses propres règles de nouvelle tentative et de délai d'expiration). Sur une route, dans un fichier de module, dans un langage publié ou dans le noyau partagé, un décorateur cache une politique là où personne n'en cherche.

## Signalé

- un import de `@ddd-ts-kit/aspects/decorators` dans `presentation/`, dans `<context>.module.ts`, dans `published-language/`, dans tout autre fichier de production d'un contexte hors de `infrastructure/`, dans le noyau partagé, dans `main.ts` et dans toute autre source sous la racine des sources (`apps/<context>/main.ts` compris)

Incorrect :

```ts
// src/contexts/billing/presentation/http/issue-invoice.route.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';
```

Correct :

```ts
// src/contexts/billing/billing.module.ts
import { retry, timeout } from '@ddd-ts-kit/aspects';

builder.bind(PaymentGateway).toClass(StripePaymentGateway, [PaymentSettings]).with(retry({ attempts: 3 }), timeout(2000));

// src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts
import { Retry } from '@ddd-ts-kit/aspects/decorators';
```

## Détails

Seule l'entrée `/decorators` est jugée : les enveloppes de `@ddd-ts-kit/aspects` (`retry`, `timeout`, `aspects`, les *middlewares* du bus) sont ce qu'un fichier de module et `main.ts` sont censés importer. Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques et `require()` sont tous lus.

Dans `domain/` et `application/`, chaque entrée de `@ddd-ts-kit/aspects` est déjà refusée par `layer-domain-purity` et `layer-application-inward` : cette règle s'y tait, pour qu'un import donne un seul signalement. Les tests et les fichiers hors de la racine des sources (scripts, fichiers de configuration) ne sont pas jugés.

## Options

Aucune. `platformDir` et `sourceRoot` de `ddd-ts-kit.config.json` disent où sont la plateforme et les sources.

`rules."aspects/outside-in"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line aspects/outside-in -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un décorateur réexporté par un fichier de `infrastructure/` ou de la plateforme et importé de là n'est pas suivi.
- Un décorateur maison construit sur `weave` ou sur un aspect de l'entrée racine n'est pas reconnu.
- Avec `layer/domain-purity` ou `layer/application-inward` à `off`, rien ne signale les décorateurs dans cette couche.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir des spécificateurs d'import qu'il lit dans le texte des fichiers, avec les mêmes exemptions. Cette règle fait autorité.
