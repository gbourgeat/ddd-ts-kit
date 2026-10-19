[English](tracing-platform-only.md) · **Français**
<!-- translation-of: tracing-platform-only.md sha256:095717c568340310 -->

# ddd-ts-kit/tracing-platform-only

Identifiant d'architecture : `tracing/platform-only`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier sous la racine des sources, tests compris, sauf le répertoire de la plateforme, `main.ts` et `apps/`.

## Pourquoi

Le traçage est non invasif : la plateforme le câble une fois, et une action est une trace parce que chaque *span* est ouvert par les mêmes quelques endroits (la frontière de la requête HTTP, le *middleware* du bus, l'instrumentation autour des adaptateurs et des gestionnaires, le relais de l'outbox). Un contexte qui importe le *package* de traçage ou l'API OpenTelemetry ouvre ses propres *spans*, avec des noms et des attributs que personne ne relit, et ne peut plus être tracé autrement, ou plus du tout, en changeant seulement la racine de composition.

## Signalé

- un import de `@ddd-ts-kit/tracing` ou de l'une de ses entrées (`/node`, `/testing`) hors du répertoire de la plateforme, de `main.ts` et de `apps/`
- un import de n'importe quel *package* `@opentelemetry/*` aux mêmes endroits

Incorrect :

```ts
// src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts
import { trace } from '@opentelemetry/api';

export class StripePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string): Promise<void> {
    await trace.getTracer('billing').startActiveSpan('charge', () => this.client.charge(invoiceId));
  }
}
```

Correct :

```ts
// src/platform/observability/tracing.ts : le seul endroit qui connaît le package de traçage
import { traceApplication, tracedPublisher } from '@ddd-ts-kit/tracing';
import { initTracing } from '@ddd-ts-kit/tracing/node';

// src/contexts/billing/infrastructure/external/stripe-payment.gateway.ts
export class StripePaymentGateway implements PaymentGateway {
  async charge(invoiceId: string): Promise<void> {
    await this.client.charge(invoiceId);
  }
}
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, les `import()` dynamiques et `require()` sont tous lus. Le répertoire de la plateforme est `platformDir` de `ddd-ts-kit.config.json`, la racine des sources est `sourceRoot` ; `main.ts` est celui de la racine des sources et `apps/` le répertoire de ce nom à la racine des sources (`src/apps/<context>/main.ts`, `src/apps/worker/main.ts`).

Jugés : chaque couche d'un contexte, son fichier de module et ses tests, le noyau partagé et tout autre fichier sous la racine des sources. Non jugés : les fichiers hors de la racine des sources (le répertoire `test/` à la racine du projet, `scripts/`, les fichiers de configuration).

Dans `domain/` et `application/`, les règles de couche refusent le même import sous leur propre identifiant, si bien qu'un import y donne deux signalements : `layer/*` dit que la couche est pure, cette règle dit où vit le traçage.

## Options

Aucune. `platformDir` et `sourceRoot` de `ddd-ts-kit.config.json` disent où sont la plateforme et les sources.

`rules."tracing/platform-only"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line tracing/platform-only -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un utilitaire de traçage réexporté par un fichier de la plateforme et importé de là n'est pas suivi : un contexte est censé ne rien recevoir du tout, et une plateforme qui exporte son traceur vers les contextes met la règle en échec.
- Une autre bibliothèque de traçage (le SDK d'un fournisseur d'observabilité qui n'est pas sous `@opentelemetry/`) n'est pas reconnue.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir des spécificateurs d'import qu'il lit dans le texte des fichiers, avec les mêmes exemptions. Cette règle fait autorité.
