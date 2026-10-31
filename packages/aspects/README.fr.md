[English](README.md) · **Français**
<!-- translation-of: README.md sha256:74dffd8c091dae5f -->

# @ddd-ts-kit/aspects

La journalisation, les métriques, les nouvelles tentatives (retry), les délais d'expiration
(timeout), les disjoncteurs (circuit breaker) et le cache ne sont pas de la logique métier : ils
ne s'écrivent donc jamais dedans. Chacun est un aspect : une seule implémentation, posée autour
d'un adaptateur depuis l'extérieur, comme `@ddd-ts-kit/tracing` pose des *spans* autour de lui.
La classe enveloppée n'importe rien, et `domain/` et `application/` ne voient jamais ce
*package*.

```
npm i @ddd-ts-kit/aspects
```

## Sa place dans une application

Un appel quitte un cas d'usage par un port. Ce qui lui répond est l'adaptateur lié à ce port,
enveloppé par les aspects que la racine de composition a posés autour de lui. Le cas d'usage
lui-même est enveloppé aussi, mais par les bus : leurs *middlewares* journalisent et mesurent
chaque commande et chaque requête.

![Une route appelle le bus de commandes, dont les middlewares de journalisation et de métriques s'exécutent autour du gestionnaire ; le gestionnaire appelle le port PaymentGateway ; l'appel traverse logged, timed, retry et timeout avant d'atteindre l'adaptateur StripeGateway, qui appelle l'API Stripe ; la racine de composition a mis en place les aspects et les middlewares, et ni le domaine ni l'application n'importent le package](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/aspects-place-in-an-application.fr.svg)

Au lieu d'écrire la politique dans chaque adaptateur, écrivez l'adaptateur seul et posez la
politique autour de lui :

<!-- checked sample -->
```ts
import { compose, retry, timeout } from '@ddd-ts-kit/aspects';

interface Quote {
  readonly pair: string;
  readonly rate: number;
}

declare function fetchQuote(pair: string): Promise<Quote>;

export abstract class ExchangeRates {
  abstract quoteOf(pair: string): Promise<Quote>;
}

// Au lieu de : la boucle de nouvelles tentatives, ses attentes et sa limite écrites dans l'adaptateur,
// une fois de plus dans chaque adaptateur, et invisibles depuis la racine de composition.
export class TangledRates implements ExchangeRates {
  async quoteOf(pair: string): Promise<Quote> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fetchQuote(pair);
      } catch (error) {
        if (attempt === 3) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }
}

// Écrivez : l'adaptateur fait son seul travail...
export class HttpRates implements ExchangeRates {
  async quoteOf(pair: string): Promise<Quote> {
    return fetchQuote(pair);
  }
}

// ...et la racine de composition pose la politique autour de lui : le même objet, toujours un HttpRates.
export const rates: ExchangeRates = compose(retry({ attempts: 3 }), timeout(2000))(new HttpRates(), { kind: 'external' });
```

## Trois formes, une implémentation

La même politique, écrite de trois façons. Les trois exécutent le même code.

### 1. Dans la racine de composition, sur une liaison (à préférer)

<!-- checked sample -->
```ts
import { retry, timeout } from '@ddd-ts-kit/aspects';
import { defineContextModule } from '@ddd-ts-kit/di';

interface Payment {
  readonly orderId: string;
  readonly amountCents: number;
}

interface Receipt {
  readonly chargeId: string;
}

declare function post(url: string, body: Payment, options: { apiKey: string; signal?: AbortSignal | undefined }): Promise<Receipt>;
declare const config: { readonly stripe: { readonly url: string; readonly key: string } };

// contexts/billing/application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(payment: Payment, signal?: AbortSignal): Promise<Receipt>;
}

// contexts/billing/application/ports/payment-settings.port.ts
export abstract class PaymentSettings {
  abstract readonly baseUrl: string;

  abstract readonly apiKey: string;
}

// contexts/billing/infrastructure/external/stripe.gateway.ts
export class StripeGateway implements PaymentGateway {
  constructor(private readonly settings: PaymentSettings) {}

  async charge(payment: Payment, signal?: AbortSignal): Promise<Receipt> {
    return post(`${this.settings.baseUrl}/charges`, payment, { apiKey: this.settings.apiKey, signal });
  }
}

// contexts/billing/billing.module.ts
export const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder.bind(PaymentSettings).toValue({ baseUrl: config.stripe.url, apiKey: config.stripe.key });
    builder
      .bind(PaymentGateway)
      .toClass(StripeGateway, [PaymentSettings])
      .as('external')
      .with(retry({ attempts: 3 }), timeout(2000, { signal: true }));
  },
});
```

Le port est une classe abstraite et c'est la classe qui est liée. `StripeGateway` n'a aucun
import de ce *package* et ne connaît pas la politique. Dans le style déclaré, celui par défaut
d'un projet généré, il n'y a pas de fichier de module et la même politique s'énonce dans la
déclaration de l'adaptateur : `@Adapter(PaymentGateway, { kind: 'external', aspects: [retry({ attempts: 3 }), timeout(2000)] })`. Sans conteneur, un aspect est une fonction :
`retry({ attempts: 3 })(new StripeGateway(settings), { kind: 'external' })`.

### 2. Dans la racine de composition, sur chaque liaison

<!-- checked sample -->
```ts
// main.ts
import { Cache, Clock, Logger, Metrics } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule, type ContextModule } from '@ddd-ts-kit/di';
import { StdoutLogger, aspects, forKinds, installAspectRuntime, logged, retry, timed, timeout, when, type Aspect } from '@ddd-ts-kit/aspects';

declare const tracing: Aspect; // ci-dessous
declare const platformModule: ContextModule;
declare const billingModule: ContextModule;

const app = createApplication({
  modules: [kernelModule({ logger: new StdoutLogger() }), platformModule, billingModule],
  decorate: aspects(
    tracing,
    when(forKinds('repository', 'gateway', 'external'), logged(), timed()),
    when(forKinds('external'), retry({ attempts: 3 }), timeout(2000)),
  ),
});

installAspectRuntime({
  logger: app.resolve(Logger),
  metrics: app.resolve(Metrics),
  cache: app.resolve(Cache),
  clock: app.resolve(Clock),
});
```

`tracing` est le *hook* du *package* de traçage écrit comme un aspect :

<!-- checked sample -->
```ts
import type { Aspect } from '@ddd-ts-kit/aspects';
import { traceDependency } from '@ddd-ts-kit/tracing';

export const tracing: Aspect = (instance, info) =>
  info?.kind === undefined ? instance : traceDependency(instance, { kind: info.kind, ...(info.context === undefined ? {} : { context: info.context }) });
```

Une application sur `kernelModule({ instrumentation: traceApplication() })`, ce que génère la
CLI, n'écrit pas cet aspect `tracing` : le module du noyau trace lui-même les liaisons. Son
*span* est à l'intérieur de tout ce qu'ajoute le *hook* `decorate` et à l'extérieur des aspects
d'une liaison (voir « Ordre »). Un projet généré n'utilise pas non plus le *hook* `decorate` :
son module de plateforme pose la politique par défaut autour des adaptateurs qui sortent du
processus avec
`builder.around(['external', 'gateway'], () => when(forKinds('external', 'gateway'), retry(...), timeout(...)))`,
et un adaptateur qui énonce sa propre politique l'enveloppe dans `ownPolicy(...)` de
`platform/resilience/`, que la politique par défaut laisse alors tranquille.

### 3. Comme décorateur, sur un adaptateur

<!-- checked sample -->
```ts
// contexts/billing/infrastructure/external/stripe.gateway.ts
import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';

interface Payment {
  readonly orderId: string;
  readonly amountCents: number;
}

interface Receipt {
  readonly chargeId: string;
}

declare function post(url: string, body: Payment, options: { apiKey: string; signal?: AbortSignal | undefined }): Promise<Receipt>;

abstract class PaymentGateway {
  abstract charge(payment: Payment, signal?: AbortSignal): Promise<Receipt>;
}

abstract class PaymentSettings {
  abstract readonly baseUrl: string;

  abstract readonly apiKey: string;
}

export class StripeGateway implements PaymentGateway {
  constructor(private readonly settings: PaymentSettings) {}

  @Retry({ attempts: 3 })
  @Timeout(2000, { signal: true })
  async charge(payment: Payment, signal?: AbortSignal): Promise<Receipt> {
    return post(`${this.settings.baseUrl}/charges`, payment, { apiKey: this.settings.apiKey, signal });
  }
}
```

`@Retry`, `@Timeout`, `@Cached`, `@Logged`, `@Timed`, `@CircuitBreaker`, `@Bulkhead`, et
`decoratorOf(adviceFactory)` pour un aspect du projet. Plusieurs sur une même méthode
s'imbriquent dans l'ordre de lecture : le premier écrit est le plus extérieur. La classe ne
reçoit ni *logger*, ni métriques, ni cache dans son constructeur : les décorateurs les lisent
dans le *runtime* des aspects au moment d'un appel.

### Quelle forme

- **Préférez la racine de composition** (formes 1 et 2). L'adaptateur reste libre de tout
  import, la politique de toute une application se lit en un seul endroit, et elle change sans
  toucher à une classe.
- **Un décorateur est acceptable** sur un adaptateur de `infrastructure/` ou de `platform/` dont
  la politique fait partie de ce qu'il est : un client d'un fournisseur qui documente ses
  propres règles de nouvelle tentative et de délai d'expiration. N'appliquez pas le même aspect
  sous les deux formes : il s'exécuterait deux fois.
- **Jamais dans `domain/` ni dans `application/`**, sous aucune forme : `layer/domain-purity` et
  `layer/application-inward` interdisent l'import. Un cas d'usage reçoit son comportement
  transverse d'un *middleware* de bus, plus bas.

## Aspects

| Aspect | Ce qu'il fait | Politique par défaut | N'enregistre jamais |
|---|---|---|---|
| `logged({ level?, fields?, logger?, clock? })` | entrées `<Class>.<method> started` (debug), puis `succeeded` (`level`, info par défaut) ou `failed` | une `DomainError` échoue au niveau `warn`, une défaillance au niveau `error` ; champs `class`, `method`, `kind`, `context`, `durationMs`, `errorType`, `errorCode` | les arguments, les résultats, les messages d'erreur |
| `timed({ name?, metrics?, clock? })` | histogramme `<name>_duration_ms`, compteur `<name>_total` | `name` vaut `dependency_call` ; libellés `class`, `method`, `kind`, `context`, `outcome`, `error_code` | les arguments, les résultats, les messages d'erreur, les identifiants |
| `retry({ attempts, backoff?, retryOn?, sleep? })` | rappelle après un échec | jamais après une `DomainError`, un circuit ouvert ou une cloison pleine (`isTransient`) ; 100 ms doublés jusqu'à 30 s avec gigue complète | rien : il n'enregistre rien |
| `timeout(ms, { signal?, scheduler? })` | rejette avec `TimeoutError` (`TIMEOUT`) | l'appel sous-jacent continue de s'exécuter, sauf avec `signal: true` | le message ne nomme que la classe et la méthode |
| `circuitBreaker({ failureThreshold, resetAfterMs, halfOpenMax?, scope?, isFailure?, onStateChange?, clock? })` | refuse les appels avec `CircuitOpenError` (`CIRCUIT_OPEN`) après des échecs consécutifs, puis laisse passer des appels d'essai | un circuit par instance et par méthode ; une `DomainError` n'est pas un échec ; un appel d'essai | `onStateChange` reçoit la classe, la méthode, le contexte et les deux états |
| `cached({ key, ttlMs, cache?, allowKinds? })` | répond à une lecture répétée depuis le port `Cache` | refuse les genres `repository` et `use-case` ; un appel dont la clé est `undefined` n'est pas mis en cache ; les échecs ne sont pas mis en cache ; des appels identiques simultanés partagent un seul appel ; un cache défaillant vaut un défaut de cache | la clé est construite par le projet à partir des arguments et ne va qu'au cache |
| `bulkhead({ maxConcurrent, maxQueued?, scope? })` | borne les appels qui s'exécutent en même temps, refuse au-delà avec `BulkheadFullError` (`BULKHEAD_FULL`) | pas de file d'attente ; un compartiment par instance et par méthode | rien |

**Confidentialité.** La règle est celle du traçage : une entrée, un libellé ou une erreur levée
par ce *package* porte des noms issus du code (classe, méthode, contexte, genre), une durée, la
classe d'une erreur et son `code` court. Jamais un argument, un résultat ou le message d'une
erreur capturée : ils citent des données. Les erreurs sont relancées intactes.

**`timeout` et l'annulation.** Avec `signal: true`, la méthode reçoit un `AbortSignal` comme
dernier paramètre déclaré, interrompu quand le temps est écoulé. Déclarez `signal?: AbortSignal`
en dernier, sans valeur par défaut, et passez-le à l'appel sous-jacent. Un signal que l'appelant
a passé à cet endroit est conservé : l'un ou l'autre interrompt. Une méthode sans paramètre n'en
reçoit aucun.

**`retry` et la gigue.** `backoff: { baseMs, factor, maxMs, jitter }`. `jitter` est une fonction
`(delayMs, attempt) => delayMs` : `fullJitter()` par défaut, `fullJitter(seededRandom)` ou
`noJitter` pour un calendrier déterministe. `sleep` remplace complètement l'attente. L'attente
après la tentative `n` en échec vaut `baseMs x factor^(n - 1)`, plafonnée à `maxMs`, puis
soumise à la gigue : `delayBeforeRetry(n, backoff)` la calcule.

**`circuitBreaker` et les métriques.** `onStateChange: circuitStateGauge()` publie l'état dans
la jauge `circuit_breaker_state` : 0 fermé, 1 semi-ouvert, 2 ouvert.

![Les trois états d'un circuit : fermé laisse passer chaque appel et compte les échecs consécutifs ; après failureThreshold d'entre eux, il s'ouvre et refuse chaque appel avec CircuitOpenError ; après resetAfterMs, il est semi-ouvert et laisse passer halfOpenMax appels d'essai ; un appel d'essai qui répond le ferme, un appel d'essai qui échoue le rouvre](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/aspects-circuit-breaker-states.fr.svg)

Un refus métier (une `DomainError`) prouve que la dépendance répond : il remet le compte à zéro
comme un succès. Une politique pour un fournisseur qui peut disparaître un moment, dans l'ordre
qu'expliquent les sections suivantes :

<!-- checked sample -->
```ts
import { circuitBreaker, circuitStateGauge, compose, retry, timeout } from '@ddd-ts-kit/aspects';

export const paymentProviderPolicy = compose(
  // Le plus extérieur : un circuit ouvert arrête aussitôt les nouvelles tentatives (retry ne retente jamais CIRCUIT_OPEN).
  retry({ attempts: 3, backoff: { baseMs: 200 } }),
  // Cinq échecs consécutifs l'ouvrent pour 30 s ; la jauge circuit_breaker_state le suit.
  circuitBreaker({ failureThreshold: 5, resetAfterMs: 30_000, onStateChange: circuitStateGauge() }),
  // Le plus intérieur : chaque tentative a ses propres 2 s.
  timeout(2000),
);
```

**`cached` est fait pour les lectures des *gateways* et des adaptateurs externes.** Un agrégat
servi depuis un cache derrière un *repository* masque qu'il est périmé, et la commande suivante
déciderait sur un état ancien. Envelopper un *repository* ou un cas d'usage exige donc un
`allowKinds: ['repository']` explicite, qui est une décision à consigner.

Un projet écrit son propre aspect avec `defineAspect((joinPoint) => async ({ args, proceed }) => ...)`.
La fonction extérieure s'exécute une fois par méthode de chaque instance enveloppée et peut
répondre `undefined` pour laisser cette méthode tranquille ; la fonction intérieure s'exécute à
chaque appel, et `proceed()` appelle ce qui est à l'intérieur :

<!-- checked sample -->
```ts
import { defineAspect, type Aspect } from '@ddd-ts-kit/aspects';
import type { Clock, Logger } from '@ddd-ts-kit/kernel';

/** Avertit quand un appel dure plus que le seuil : des noms issus du code et une durée, jamais les arguments. */
export function warnWhenSlow(thresholdMs: number, logger: Logger, clock: Clock): Aspect {
  return defineAspect((joinPoint) => async ({ proceed }) => {
    const startedAt = clock.now().getTime();

    try {
      return await proceed();
    } finally {
      const durationMs = clock.now().getTime() - startedAt;

      if (durationMs > thresholdMs) {
        logger.warn(`${joinPoint.className}.${joinPoint.method} slow`, { durationMs, thresholdMs });
      }
    }
  });
}
```

## Choisir ce qui est enveloppé

`when(selector, ...aspects)` applique des aspects aux méthodes qu'un sélecteur choisit :

| Sélecteur | Choisit |
|---|---|
| `forKinds('repository', 'external')` | les instances liées avec `.as(kind)` |
| `forContext('billing')` | les instances d'un module |
| `forClasses('Http*')` | les instances, par nom de classe |
| `forMethods('find*', 'get*')` | les méthodes, par nom |
| `allOf(...)`, `anyOf(...)`, `not(...)` | des combinaisons |

<!-- checked sample -->
```ts
import { allOf, cached, forKinds, forMethods, when } from '@ddd-ts-kit/aspects';

// Le seul endroit où les arguments sont lus : construire la clé à partir d'un identifiant, jamais de données personnelles.
// `undefined` laisse l'appel hors du cache. La clé de cache contient aussi la classe et la méthode.
const key = (_method: string, [id]: readonly unknown[]): string | undefined => (typeof id === 'string' ? id : undefined);

export const cacheReads = when(allOf(forKinds('gateway', 'external'), forMethods('find*')), cached({ key, ttlMs: 60_000 }));
```

## Ordre

`compose(a, b)`, `.with(a, b)`, `aspects(a, b)` et les décorateurs empilés se lisent tous de la
même façon : **le premier est le plus extérieur**. Autour d'une instance, l'application
imbrique, du plus extérieur au plus intérieur : le *hook* `decorate`, les aspects que les
modules posent autour d'un genre avec `builder.around(kinds, ...)` dans l'ordre des modules (le
*span* de `kernelModule({ instrumentation })` vient d'abord, puis, pour un *repository*, la
remise de ses événements du domaine, puis ceux du module de plateforme), et enfin les aspects de
la liaison elle-même (`.with(...)`, ou `aspects` d'une déclaration). Les décorateurs posés sur
les méthodes de la classe sont à l'intérieur de tous ceux-là.

![Six niveaux imbriqués autour de la méthode d'une instance (un adaptateur ou un repository), du plus extérieur au plus intérieur : le hook decorate de createApplication ; le span de l'instrumentation de kernelModule ; pour un repository, la remise de ses événements du domaine ; les aspects du module de plateforme posés avec builder.around ; les aspects de la liaison, .with ou les aspects d'une déclaration ; les décorateurs de méthode de la classe ; puis la méthode elle-même](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/aspects-order-of-wrappers.fr.svg)

L'ordre change le sens :

- `retry` puis `timeout` : chaque tentative a sa propre limite de temps. Dans l'autre sens, une
  seule limite couvre toutes les tentatives et les attentes entre elles.
- `timed` et `logged` à l'extérieur de `retry` : une mesure par appel tel que l'appelant l'a
  vécu, nouvelles tentatives comprises. À l'intérieur, une par tentative.
- `cached` à l'extérieur de `retry` et de `circuitBreaker` : un succès de cache ne coûte rien et
  n'est pas refusé par un circuit ouvert.
- `circuitBreaker` à l'intérieur de `retry` : chaque tentative en échec compte, et un circuit
  ouvert arrête aussitôt les nouvelles tentatives, puisque `retry` ne retente pas une
  `CircuitOpenError`.

![Deux chronologies. Avec retry à l'extérieur de timeout, chacune des trois tentatives a sa propre limite de 2 s, et l'appel peut durer trois fois 2 s plus les attentes. Avec timeout à l'extérieur de retry, une seule limite de 2 s couvre ensemble les tentatives et les attentes, et l'appel est rejeté avec TimeoutError à 2 s, quelle que soit la tentative en cours](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/aspects-retry-and-timeout-order.fr.svg)

<!-- checked sample -->
```ts
import { compose, retry, timeout } from '@ddd-ts-kit/aspects';

// Chaque tentative a ses propres 2 s : l'appel peut durer 3 x 2 s, plus les attentes entre les tentatives.
export const limitPerAttempt = compose(retry({ attempts: 3 }), timeout(2000));

// Une seule limite de 2 s pour tout l'appel : tentatives et attentes ensemble.
export const limitForTheCall = compose(timeout(2000), retry({ attempts: 3 }));
```

L'ordre qui convient à la plupart des adaptateurs, du plus extérieur au plus intérieur :

```
tracing, logged, timed, cached, retry, circuitBreaker, bulkhead, timeout, the adapter
```

Avec l'instrumentation du module du noyau, le *span* de traçage est là où le module du noyau le
pose : `logged` et `timed` donnés au *hook* `decorate` sont à l'extérieur du *span*, ceux donnés
à `builder.around` ou à une liaison sont à l'intérieur.

Un *repository* a une enveloppe de plus, posée par `kernelModule()` entre le *hook* `decorate`
et les aspects de sa liaison : la remise des événements du domaine de ce qu'il enregistre, que
l'unité de travail diffuse à sa fin, avant la validation (commit). Les aspects d'une liaison
(`.with(retry(...))`) sont donc à l'intérieur, là où un enregistrement retenté annonce ses
événements une seule fois. Dans une unité de travail, un gestionnaire de ces événements ne
s'exécute plus pendant l'enregistrement, si bien qu'aucune nouvelle tentative d'un
enregistrement ne le couvre jamais. Hors de toute unité de travail, l'enregistrement diffuse
avant de se résoudre : un `retry` donné au *hook* `decorate` relancerait alors l'enregistrement
après l'échec d'un gestionnaire, sans plus aucun événement à diffuser. Posez le `retry` d'un
*repository* sur sa liaison.

## Le runtime des aspects

`logged`, `timed` et `cached` ont besoin d'un *logger*, de métriques et d'un cache. Ils les
prennent dans leurs options, ou dans le *runtime* que la racine de composition installe une fois
avec `installAspectRuntime({ logger, metrics, cache, clock, scheduler })`. Le *runtime* est lu au
moment d'un appel, jamais quand une classe est décorée ou une instance enveloppée, si bien que
l'ordre des instructions de `main.ts` n'a pas d'importance. Un collaborateur manquant lève
`AspectRuntimeError`, qui le nomme. L'horloge et le planificateur valent par défaut ceux du
système. `Scheduler` est le port de ce *package* pour « exécuter ceci plus tard »
(`schedule(work, delayMs)`), une classe abstraite comme les ports du noyau : `systemScheduler`
est sa valeur par défaut, `ManualScheduler` de `./testing` celle d'une *spec*.

## Cas d'usage : middlewares de bus

Les gestionnaires ne sont pas enveloppés un par un ; ce sont les bus qui le sont :

<!-- checked sample -->
```ts
import { loggingMiddleware, metricsMiddleware } from '@ddd-ts-kit/aspects';
import { InMemoryCommandBus, InMemoryQueryBus, type Logger, type Metrics } from '@ddd-ts-kit/kernel';

declare const logger: Logger;
declare const metrics: Metrics;

export const commands = new InMemoryCommandBus().use(loggingMiddleware(logger)).use(metricsMiddleware(metrics));
export const queries = new InMemoryQueryBus().use(loggingMiddleware(logger)).use(metricsMiddleware(metrics));
```

Mêmes entrées et mêmes séries que `logged` et `timed` (préfixe `use_case`), nommées d'après la
classe du message, jamais d'après son contenu : `command ChargeOrder started`, puis `succeeded`
ou `failed`, avec les champs `message` et `messageKind`, et les séries `use_case_duration_ms` et
`use_case_total` étiquetées `message` et `kind`. Il n'existe pas de *middleware* qui ouvre une
`ExecutionScope` : une commande ne porte pas d'identifiant de corrélation, et la portée doit
déjà être ouverte quand la route ou le consommateur s'exécute, avant tout bus. Ouvrez-la à la
frontière.

## StdoutLogger

Un petit adaptateur du port `Logger` du noyau qui écrit des lignes JSON :

<!-- checked sample -->
```ts
import { StdoutLogger } from '@ddd-ts-kit/aspects';
import { logFieldsOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';

declare const scope: ExecutionScope;

// Sans traçage : l'identifiant de corrélation, l'acteur et le tenant du contexte d'exécution courant.
export const logger = new StdoutLogger({
  level: 'info',
  base: { service: 'shop-api' },
  fields: () => {
    const context = scope.current();

    return context === undefined ? {} : logFieldsOf(context);
  },
});

// Avec @ddd-ts-kit/tracing : les mêmes champs, plus trace_id et span_id du span actif.
export const tracedLogger = new StdoutLogger({ base: { service: 'shop-api' }, fields: () => traceLogFields(scope) });

logger.info('payment accepted', { orderId: 'o-42' });
// {"time":"2026-03-01T10:00:00.000Z","level":"info","message":"payment accepted","service":"shop-api","correlationId":"...","origin":"http","actorId":"...","orderId":"o-42"}
```

`fields` est lu à chaque entrée. Ce *package* ne dépend ni du *package* de traçage ni d'une
portée d'exécution : c'est le projet qui choisit ce que porte chaque entrée. Quand le même champ
vient de plusieurs endroits, le dernier l'emporte : `base`, puis les champs de `child(...)`, puis
`fields()`, puis les champs de l'appel de journalisation. Aucun ne peut écraser `time`, `level`
ou `message`.

Il implémente tout le port, tenu par `loggerContract` comme les adaptateurs pino et winston :

- **Erreurs.** Une `Error` passée comme champ (`logger.error('payment failed', { error })`) est
  écrite comme la décrit `describeError` du noyau : `type`, `code` pour une `DomainError`,
  `message`, `stack`, puis `cause` de la même façon. `scrubMessages: true` écrit
  `[message removed]` pour le message de toute erreur qui n'est pas une `DomainError` : activez-le
  quand les journaux quittent vos mains. `logged` et `loggingMiddleware` ne sont pas concernés :
  ils ne passent jamais d'erreur, seulement `errorType` et `errorCode`.
- **`isLevelEnabled(level)`** répond selon le seuil (`level`, `info` par défaut). `logged` et
  `loggingMiddleware` l'interrogent d'abord : sous le seuil, aucun champ n'est construit et la
  fonction `fields` de `logged` n'est pas appelée.
- **`flush()`** se résout une fois que la sortie standard a pris chaque ligne écrite jusque-là,
  et ne rejette jamais ; le *logger* reste utilisable ensuite. `app.stop()` du *package* di
  l'appelle en dernier.
- **`stream`** envoie les lignes vers un autre flux que la sortie standard, et `flush()` attend
  ce flux. Un `write` du projet reçoit chaque ligne à la place et l'emporte sur `stream`.
- **Un appel de journalisation ne lève jamais d'exception.** Des champs qui ne peuvent être ni
  lus ni sérialisés (un accesseur qui lève, un objet circulaire), sur une entrée ou sur un
  enfant, donnent l'entrée sans eux, marquée `logError: "unserializable fields"`.

Il masque les secrets d'authentification comme `@ddd-ts-kit/pino` et `@ddd-ts-kit/winston` : la
valeur de chaque clé de `CREDENTIAL_KEYS` du noyau, quelle que soit sa casse (`isCredentialKey`),
est écrite `[redacted]` au premier niveau d'une entrée et un niveau en dessous
(`headers.authorization`), dans les champs d'une ligne, d'un enfant, de `base` et de `fields`.
Rien de plus profond, ni dans une liste. Les objets passés ne sont jamais modifiés.

## Ce que garantit l'enveloppement

- L'instance est enveloppée sur place : même objet, `instanceof`, `this` et membres `private`
  intacts. Une instance gelée est placée derrière un proxy du même type, et ses méthodes
  s'exécutent avec ce proxy comme `this`.
- **Un aspect appliqué à une instance intercepte les appels qui lui parviennent de l'extérieur.**
  `private` est effacé par le compilateur, et un nom ne dit pas si une méthode est publique (un
  tiret bas est une habitude, pas une règle) : l'API publique ne peut donc pas être distinguée
  de façon fiable. Chaque méthode asynchrone accessible par son nom, y compris une méthode
  `private async` et un champ qui contient une fonction asynchrone, est enveloppée. Ce qui
  distingue les appels, c'est leur provenance. Pendant qu'un appel intercepté (*advised call*)
  s'exécute sur une instance, un appel que cette instance fait sur elle-même, vers une méthode
  publique ou `private`, est l'intérieur de cet appel et n'est pas intercepté à nouveau par le même aspect :
  `retry({ attempts: 3 })` autour d'une méthode publique qui passe par une étape privée fait
  trois tentatives, pas neuf, et `logged()` et `timed()` enregistrent un seul appel. La garde
  est tenue par instance et par aspect, et suit le flux asynchrone de l'appel
  (`AsyncLocalStorage`) : deux appels faits de l'extérieur en même temps sont tous deux
  interceptés, tout comme ce qu'un appel intercepté a laissé derrière lui (un minuteur, un
  écouteur) une fois cet appel terminé.
- Ce qui en découle : un appel qui revient vers l'instance depuis un collaborateur pendant que
  l'appel intercepté s'exécute est lui aussi l'intérieur de cet appel ; `cached` sert les
  appelants de l'extérieur, pas une méthode qui en lit une autre par `this` ; `bulkhead` et
  `circuitBreaker` comptent un seul appel. Un décorateur de méthode n'est pas concerné : il
  intercepte la seule méthode sur laquelle il est posé, à chaque appel, y compris ceux faits par
  `this`.
- Le traçage diffère à dessein : `traceDependency` de `@ddd-ts-kit/tracing` ouvre un *span*
  enfant pour un appel qu'une instance fait sur elle-même. Un *span* décrit une étape, là où un
  *advice* (le code de l'aspect qui enveloppe l'appel) agit sur elle.
- Une instance gelée reste gelée : ses champs, y compris les champs `private`, ne peuvent pas
  être affectés. L'état qu'elle doit changer vit dans un objet qu'elle détient (une `Map`, un
  tableau).
- Appliquer deux fois le même aspect à une instance est sans effet.
- Les accesseurs, les symboles, les générateurs, les méthodes synchrones et les *hooks* de cycle
  de vie (`LIFECYCLE_HOOKS`) sont laissés tranquilles.
- Une méthode déclarée `async` est interceptée dès son premier appel. Une méthode qui se contente
  de renvoyer une promesse est interceptée à partir de son deuxième appel : déclarez `async` les
  méthodes des adaptateurs. Une méthode décorée est toujours interceptée.

## Tests

Les enveloppes prennent leurs collaborateurs en options, si bien qu'une *spec* passe des *fakes*
du noyau. Pour les classes décorées et pour les aspects qui lisent le *runtime*,
`@ddd-ts-kit/aspects/testing` fournit `createAspectFakes()` (un *logger*, des métriques et un
cache en mémoire, une horloge fixe et un `ManualScheduler` sur la même horloge) et
`withAspectRuntime(runtime, work)` :

<!-- checked sample -->
```ts
import { expect, it } from 'vitest';
import { Logged, Timeout } from '@ddd-ts-kit/aspects/decorators';
import { createAspectFakes, withAspectRuntime } from '@ddd-ts-kit/aspects/testing';

const fetchRate = (_pair: string): Promise<number> => new Promise(() => undefined); // un fournisseur qui ne répond jamais

class SlowRates {
  @Logged()
  @Timeout(2000)
  async rateOf(pair: string): Promise<number> {
    return fetchRate(pair);
  }
}

it('gives up after two seconds, and logs the failure without the pair', async () => {
  const fakes = createAspectFakes(); // logger, métriques, cache, horloge, planificateur
  const rates = new SlowRates();

  const pending = withAspectRuntime(fakes, () => rates.rateOf('EUR-USD'));
  fakes.scheduler.advance(2000); // le temps avance quand le test le décide

  await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
  expect(fakes.logger.entries.map((entry) => entry.message)).toEqual(['SlowRates.rateOf started', 'SlowRates.rateOf failed']);
});
```

`withAspectRuntime` vaut pour le travail et tout ce qu'il attend, et des tests concurrents ne
voient pas le *runtime* les uns des autres. Avec `createTestApplication` du *package* di,
l'application est le *runtime* : `withAspectRuntime(app, () => ...)`, puis vérifiez
`app.logger.entries` et `app.metrics`.

## Modes de décorateurs

Les décorateurs de `./decorators` fonctionnent sous les deux modes de décorateurs de TypeScript,
avec la même ligne de source.

| *Stack* | `tsconfig.json` |
|---|---|
| class-validator, NestJS, entités TypeORM, toute bibliothèque à décorateurs historiques (legacy) | `"experimentalDecorators": true` |
| tout le reste | laissez `experimentalDecorators` non défini : les décorateurs standard (TC39) n'ont besoin d'aucune option |

- **Comment le mode est détecté.** Par l'appel : le mode standard est `(method, context)` avec un
  objet de contexte, le mode historique `(prototype, name, descriptor)`. `decoratorOf` lit lequel
  il a reçu, si bien qu'une seule fonction sert les deux et qu'un aspect a une seule
  implémentation.
- **Ce qui diffère.** En mode standard, la méthode de chaque instance est enveloppée quand
  l'instance est construite. Le mode historique n'a pas d'initialiseur : la méthode est donc
  remplacée sur le prototype et l'*advice* de chaque instance est construit à son premier appel.
  L'état (un circuit, un compartiment, un vol unique) est par instance et par méthode dans les
  deux, plusieurs décorateurs s'imbriquent dans l'ordre de lecture dans les deux, et aucun n'a
  besoin de `emitDecoratorMetadata`.
- **Compilateurs.** TypeScript 5, 6 et le compilateur natif TypeScript 7 compilent les deux
  modes. Node n'exécute pas la syntaxe des décorateurs : le code est donc compilé dans les deux
  cas.
- **Vitest.** Il abaisse lui-même les décorateurs historiques : un projet avec
  `experimentalDecorators` n'a besoin de rien. Il n'abaisse pas les décorateurs standard (une
  *spec* qui importe un fichier `.ts` utilisant `@Retry` échoue sur une erreur de syntaxe) :
  ajoutez `decorators()` de `@ddd-ts-kit/testing/vitest` à la configuration de Vitest. Les
  fichiers enveloppés dans la racine de composition n'ont besoin de rien dans aucun des deux
  modes.
- **Avec une déclaration.** `@Adapter(...)` sur la classe et `@Retry(...)` sur ses méthodes se
  composent, les `aspects` de la déclaration autour des décorateurs des méthodes :
  `@Adapter(PaymentGateway, { kind: 'external' })`. Une méthode statique, une
  méthode nommée par un symbole et une méthode réellement privée (`#`) sont refusées.

Le point d'entrée `./decorators` est séparé : rien d'autre dans le *package* ne l'importe.

## Limites

- L'état (circuits, compartiments, vol unique) vit dans le processus, par instance enveloppée.
  Une liaison transitoire obtient un nouvel état à chaque instance.
- `retry` répète l'appel tel quel : seulement pour les opérations qu'on peut répéter sans
  risque.
- `timeout` sans `signal` n'arrête pas l'appel sous-jacent.
- Un appel enveloppé répond toujours une promesse : n'enveloppez pas un objet dont les méthodes
  renvoient un *query builder* chaînable.
- `when` sélectionne les méthodes des aspects faits par `defineAspect`, `compose` ou `when` ; une
  simple fonction utilisée comme aspect filtre elle-même.
