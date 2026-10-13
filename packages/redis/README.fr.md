[English](README.md) · **Français**
<!-- translation-of: README.md sha256:89da4a854822bfca -->

# @ddd-ts-kit/redis

Des adaptateurs de ports du noyau sur le protocole Redis : les ports `Cache`, `Lock` et
`RateLimiter`, le signal de réveil du relais de l'outbox, un store de *jobs* en arrière-plan, et
un fournisseur d'événements d'intégration sur Redis Streams.
Ils utilisent un sous-ensemble commun du protocole, si bien que le même code tourne sur Redis,
Dragonfly et Valkey : le choix du serveur relève de l'exploitation, et il se fait dans la racine
de composition, par une URL de connexion.

```
npm i @ddd-ts-kit/redis ioredis
```

| Point d'entrée | Contient | Importe |
|---|---|---|
| `@ddd-ts-kit/redis` | `connectRedis`, `closeRedis`, `FAIL_FAST`, `redisHealth`, `RedisCache`, `jsonCodec`, `RedisLock`, `RedisRateLimiter`, `RedisRelaySignal`, `relayWakeUpMiddleware`, `RedisJobStore`, `reportLostJobs` ; réexportés depuis le noyau : les ports `Lock` et `RateLimiter`, `InMemoryLock`, `InMemoryRateLimiter` | le noyau, `@ddd-ts-kit/scheduling`, `ioredis` (*peer*) |
| `@ddd-ts-kit/redis/event-bus` | `RedisStreamsEventBus`, ses options, ses types de topologie et d'erreur, `streamNamesOf`, `DEFAULT_PREFIX`, les codes `ATTEMPTS_EXHAUSTED` et `POISON_ENTRY`, les noms des champs d'une entrée | le noyau, `ioredis` (*peer*) |
| `@ddd-ts-kit/redis/testing` | `cacheContract`, `lockContract`, `rateLimiterContract`, réexportés depuis `@ddd-ts-kit/testing/contracts` | `@ddd-ts-kit/testing` (*peer* facultatif), le *runner* que vous passez |

## Sa place dans une application

Rien ici n'est importé depuis `domain/` ou `application/`. Un cas d'usage dépend du port
(`Cache`, `Lock`, `RateLimiter` du noyau) ; l'adaptateur est choisi dans `platform/` et lié dans
la racine de composition.

![Les six ports que le code nomme (Cache, Lock, RateLimiter, RelaySignal, JobStore, EventBus), les six adaptateurs de @ddd-ts-kit/redis qui les implémentent, et l'unique serveur auquel ils envoient leurs commandes ; la plateforme les lie, l'outbox et les événements traités restent dans la base de données](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/redis-place-in-an-application.fr.svg)

Le même cas d'usage tourne alors contre Redis en production et contre les adaptateurs en mémoire
du noyau dans ses tests. Au lieu de nommer l'adaptateur, ce qui lie le cas d'usage à un seul
serveur et que [`layer/application-inward`](../eslint-plugin/docs/rules/layer-application-inward.fr.md)
signale dans `application/`, nommez le port :

<!-- checked sample -->
```ts
import { Cache, FixedClock, InMemoryCache, cacheKey, type CacheKey } from '@ddd-ts-kit/kernel';

interface Quote {
  readonly pair: string;
  readonly rate: number;
}

interface ExchangeRates {
  quoteOf(pair: string): Promise<Quote>;
}

const quoteKey = (pair: string): CacheKey<Quote> => cacheKey<Quote>('quote', pair);

// Au lieu de `constructor(private readonly cache: RedisCache)` : le port du noyau.
export class QuoteReader {
  constructor(
    private readonly cache: Cache,
    private readonly rates: ExchangeRates,
  ) {}

  async quoteOf(pair: string): Promise<Quote> {
    const cached = await this.cache.get(quoteKey(pair));

    if (cached !== undefined) {
      return cached;
    }

    const quote = await this.rates.quoteOf(pair);
    await this.cache.set(quoteKey(pair), quote, { ttlMs: 30_000 });

    return quote;
  }
}

// Dans un test, le cache en mémoire du noyau ; en production, RedisCache, lié dans platform/.
const clock = new FixedClock(new Date('2026-10-13T09:00:00Z'));
export const reader = new QuoteReader(new InMemoryCache(clock), { quoteOf: async (pair) => ({ pair, rate: 1.08 }) });
```

Avec la CLI, `init --cache redis` écrit `platform/redis/open-redis.ts` (une connexion, le cache,
le verrou, le limiteur de débit, le signal du relais quand les événements passent par une outbox,
la sonde de disponibilité), `init --broker redis` écrit `platform/events/create-event-provider.ts`
autour de `RedisStreamsEventBus`, et `init --queue redis` (qui exige `--cache redis`) ajoute le
store de *jobs* à la même connexion. La suite présente chaque pièce, câblée à la main.

## Connexion

<!-- checked sample -->
```ts
// src/platform/redis/redis.ts
import { connectRedis, redisHealth } from '@ddd-ts-kit/redis';

declare const config: { readonly redisUrl: string };

export const redis = connectRedis(config.redisUrl); // ou des options ioredis, ou un client que vous avez déjà

export const ready = () => redisHealth(redis.client); // { status: 'up', latencyMs } | { status: 'down', reason }
export const shutdown = () => redis.close();
```

- `connectRedis(url | options | client)` répond `{ client, close() }`. Une connexion qu'il a
  ouverte est fermée par `close()` ; un client qu'on lui a remis est utilisé tel quel et laissé
  ouvert, puisque c'est son propriétaire qui le ferme.
- Une connexion ouverte ici ajoute deux réglages aux valeurs par défaut d'ioredis (`FAIL_FAST`),
  que vos options remplacent : `commandTimeout: 2000` et `maxRetriesPerRequest: 1`. Avec les
  seules valeurs par défaut, une commande envoyée pendant que le serveur est absent attend vingt
  reconnexions avant d'échouer, et chaque requête de l'application attend avec elle.
- `redisHealth(client, { timeoutMs? })` envoie un seul `PING`, ne lève jamais d'exception, et
  répond dans le délai (1 s par défaut) : utilisez-le dans une sonde de disponibilité (readiness
  probe). Un cache en panne est rarement une raison de cesser de recevoir du trafic ; un verrou ou
  un limiteur de débit en panne peut l'être.
- Chaque adaptateur prend le client ioredis, si bien que plusieurs partagent une connexion. Le
  signal du relais en ouvre une seconde, pour écouter, et le bus d'événements une par nom de
  consommateur, pour bloquer sur ses lectures.

Développement local, avec Dragonfly :

```yaml
# compose.yaml
services:
  dragonfly:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2
    ulimits:
      memlock: -1
    command: ['--maxmemory=512mb', '--proactor_threads=2']
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - dragonfly:/data
volumes:
  dragonfly:
```

`REDIS_URL=redis://127.0.0.1:6379` convient alors aux trois serveurs.

**Identifiants de connexion.** Un client d'ioredis garde ses options, mot de passe compris, et les
montre à quiconque l'inspecte : cela ne peut pas être changé d'ici, alors ne journalisez jamais un
client. Les adaptateurs de ce *package* (`RedisCache`, `RedisLock`, `RedisRateLimiter`,
`RedisRelaySignal`, `RedisJobStore`, `RedisStreamsEventBus`) gardent leur client dans un champ non
énumérable, et répondent leur nom à `JSON.stringify` et à `util.inspect` : journaliser, étaler
(spread) ou sérialiser un adaptateur ne mène pas au client. L'objet que répond `connectRedis`
donne son `client` par son nom (`redis.client`, `const { client } = redis`) et le laisse hors d'un
étalement ou d'un journal.

<!-- checked sample -->
```ts
import type { Logger } from '@ddd-ts-kit/kernel';
import { redisHealth, type RedisConnection } from '@ddd-ts-kit/redis';

declare const redis: RedisConnection;
declare const logger: Logger;

export async function logStartup(): Promise<void> {
  // Au lieu de : logger.info('redis connected', { client: redis.client }), et le mot de passe avec.
  // Écrivez ce dont un opérateur a besoin, qui ne contient aucun secret :
  const health = await redisHealth(redis.client);
  logger.info('redis connected', { status: health.status });
}
```

## Cache

`RedisCache` implémente le port `Cache` du noyau, avec sa `CacheKey` typée.

<!-- checked sample -->
```ts
// src/main.ts
import { Cache, Lock, Metrics, RateLimiter } from '@ddd-ts-kit/kernel';
import { contextModule, createApplication, defineContextModule, kernelModule, type DeclaredSource } from '@ddd-ts-kit/di';
import { RedisCache, RedisLock, RedisRateLimiter, type RedisConnection } from '@ddd-ts-kit/redis';

declare const redis: RedisConnection; // connectRedis(config.redisUrl), plus haut
declare const catalogDeclarations: DeclaredSource;

const platformModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.rebind(Cache).toFactory((resolve) => new RedisCache(redis.client, { namespace: 'app', metrics: resolve(Metrics) }));
    builder.rebind(Lock).toValue(new RedisLock(redis.client, { namespace: 'app:lock' }));
    builder.rebind(RateLimiter).toValue(new RedisRateLimiter(redis.client, { namespace: 'app:rate' }));
  },
});

export const app = createApplication({ modules: [kernelModule(), platformModule, contextModule('catalog', catalogDeclarations)] });
```

Un port du noyau est une classe abstraite, et c'est la classe qui sert de clé à une liaison : les
trois adaptateurs `implements` le leur, et un cas d'usage qui nomme `Cache`, `Lock` ou
`RateLimiter` dans ses dépendances les reçoit. `kernelModule({ cache: (resolve) => new RedisCache(...), lock: ..., rateLimiter: ... })`
fait de même par ses options. `cached` de `@ddd-ts-kit/aspects` et tout ce qui résout `Cache`
l'utilisent alors sans le savoir. Un contexte qui veut garder ses clés à part construit sa propre
instance, avec son propre `namespace`. Donnez à chaque adaptateur un espace de noms à lui, comme
ci-dessus : sans cela, le verrou écrit sous `lock:` et le limiteur de débit sous `rate:`, et deux
applications qui partagent un serveur les partageraient aussi.

| Option | Défaut | Effet |
|---|---|---|
| `namespace` | aucun | chaque clé est `<namespace>:<name>` : un par contexte délimité, ou par application qui partage un serveur |
| `codec` | `jsonCodec` | comment une valeur devient du texte, et inversement. Avec JSON, une `Date` revient sous forme de chaîne et une instance de classe sous forme d'objet simple : mettez en cache des données, pas des objets |
| `onError` | `miss` | un serveur défaillant coûte un défaut de cache (miss) en lecture et une écriture abandonnée, jamais une exception. `throw` laisse passer l'échec |
| `metrics` | aucun | compte les échecs dans `cache_errors_total`, avec les étiquettes `operation` (`get`, `set`, `delete`) et `context` (l'espace de noms) |
| `lock` | aucun | un `Lock` que `getOrLoad` utilise entre processus |

- `set(key, value, { ttlMs })` stocke avec `PX`, en millisecondes. Sans `ttlMs`, l'entrée reste
  jusqu'à ce qu'elle soit supprimée, ou évincée par le serveur ; `ttlMs: 0` ou moins la supprime.
- `deleteByPrefix('price:')` supprime chaque entrée de l'espace de noms dont le nom commence par
  le préfixe, et répond combien. Il parcourt les clés avec `SCAN` (200 à la fois), jamais `KEYS`,
  et lit le préfixe littéralement (`*`, `?`, `[` sont échappés). Il n'est pas atomique : une entrée
  écrite pendant le parcours peut survivre. C'est un outil d'administration, pas un appel à faire
  à chaque requête ; préférez des durées de vie courtes à l'invalidation.
- Une entrée qui ne peut pas être décodée est un défaut de cache, et elle est comptée.

Le type que porte une `CacheKey` est une promesse que le codec doit tenir. JSON ne la tient que
pour des données simples : mettez donc en cache la forme qu'a réellement la valeur après
l'aller-retour :

<!-- checked sample -->
```ts
import { cacheKey, type Cache } from '@ddd-ts-kit/kernel';

declare const cache: Cache;

interface Slot {
  readonly id: string;
  readonly startsAt: Date;
}

// Au lieu de : la clé promet une Date, et le cache répond une chaîne.
export async function cacheSlot(slot: Slot): Promise<void> {
  await cache.set(cacheKey<Slot>('slot', slot.id), slot, { ttlMs: 60_000 });
}

// Écrivez : des données simples, dans la forme qu'elles ont une fois relues.
interface SlotView {
  readonly id: string;
  readonly startsAt: string;
}

export async function cacheSlotView(slot: Slot): Promise<void> {
  const view: SlotView = { id: slot.id, startsAt: slot.startsAt.toISOString() };

  await cache.set(cacheKey<SlotView>('slot', slot.id), view, { ttlMs: 60_000 });
}
```

Ou donnez un `codec` (`{ encode(value): string; decode(text): unknown }`) qui connaît vos types.

**Un cache ne doit pas faire tomber l'application.** Avec `onError: 'miss'`, la valeur par défaut,
un serveur absent, plus lent que le délai d'expiration des commandes ou qui répond des erreurs
fait tourner l'application comme si elle n'avait pas de cache. Surveillez `cache_errors_total` :
un cache qui a cessé de fonctionner en silence est un incident de latence qui n'attend que la
charge.

### Protection contre la ruée (stampede)

Quand une entrée populaire expire, chaque requête qui la manque la recalcule au même moment.

- Dans un même processus, `cached` de `@ddd-ts-kit/aspects` partage déjà un seul appel
  sous-jacent entre les appels identiques concurrents (single flight). Donnez-lui un `RedisCache`
  et cette partie est réglée.
- Entre processus, utilisez `getOrLoad` avec un `lock` :

<!-- checked sample -->
```ts
import { cacheKey, type CacheKey } from '@ddd-ts-kit/kernel';
import { RedisCache, RedisLock, type RedisConnection } from '@ddd-ts-kit/redis';

declare const redis: RedisConnection;

interface Quote {
  readonly pair: string;
  readonly rate: number;
}

declare const rates: { quoteOf(pair: string): Promise<Quote> };

const quoteKey = (pair: string): CacheKey<Quote> => cacheKey<Quote>('quote', pair);

const cache = new RedisCache(redis.client, {
  namespace: 'catalog',
  lock: new RedisLock(redis.client, { namespace: 'catalog:lock' }),
});

export function quoteOf(pair: string): Promise<Quote> {
  return cache.getOrLoad(quoteKey(pair), () => rates.quoteOf(pair), { ttlMs: 30_000 });
}
```

`getOrLoad` lit l'entrée ; sur un défaut de cache, les appelants de ce processus partagent un seul
calcul, et avec un verrou un seul processus calcule : les autres attendent sa valeur jusqu'à
`waitMs` (2 s par défaut), puis la calculent eux-mêmes. Le processus qui calcule tient le verrou
pendant `lockTtlMs` au plus (10 s par défaut) : au-delà, un autre peut commencer. Il n'échoue
jamais à cause du verrou ou du serveur : le pire cas est celui d'un cache sans protection. Un
calcul qui a échoué n'est pas mis en cache. Le
[guide du cache et de la coordination](../../docs/tools/cache-and-coordination.fr.md#ce-que-ce-kit-prend-en-charge-et-a-vérifié)
dessine ces étapes.

## Verrou

`RedisLock` implémente le port `Lock` du noyau :

```ts
abstract class Lock {
  abstract acquire(key: string, options: { ttlMs: number; waitMs?: number }): Promise<LockHandle | undefined>;
}
interface LockHandle { readonly key: string; readonly fencingToken: number; release(): Promise<void> }
```

<!-- checked sample -->
```ts
import type { Lock } from '@ddd-ts-kit/kernel';

declare const lock: Lock;
declare function exportEverything(): Promise<void>;

export async function nightlyExport(): Promise<void> {
  const handle = await lock.acquire('nightly-export', { ttlMs: 60_000 });

  if (handle === undefined) {
    return; // une autre instance s'en charge déjà
  }

  try {
    await exportEverything();
  } finally {
    await handle.release();
  }
}
```

`RedisLock` est l'algorithme à instance unique de la documentation de Redis :
`SET key <random owner> NX PX ttl`, et une libération qui ne supprime la clé que si elle porte
encore ce propriétaire (comparer puis supprimer, compare-and-delete), si bien qu'un détenteur dont
le verrou a expiré ne peut pas libérer le verrou du suivant. `waitMs` interroge le serveur toutes
les `retryDelayMs` (25 ms par défaut). `InMemoryLock` du noyau est le même contrat dans un seul
processus, pour les tests et les instances uniques ; c'est à lui que `kernelModule()` de
`@ddd-ts-kit/di` lie `Lock` tant que la plateforme ne le lie pas à nouveau
(`builder.rebind(Lock)`, montré sous [Cache](#cache)).

**Ce qu'il garantit, et ce qu'il ne garantit pas.** Au plus un détenteur à la fois, à condition
que le serveur garde ses données et que le détenteur termine dans le délai `ttlMs`. Ce n'est
**pas un verrou de consensus**. Deux détenteurs sont possibles quand :

- le détenteur est mis en pause (ramasse-miettes, disque bloqué, conteneur suspendu) plus
  longtemps que la durée de vie, et continue de travailler après que le verrou est passé à
  quelqu'un d'autre ;
- le serveur bascule vers une réplique qui n'avait pas encore reçu la clé ;
- le serveur redémarre sans persistance, ou évince la clé sous la pression de la mémoire ;
- les horloges, côté serveur, font un saut.

Utilisez-le donc pour **éviter de faire un travail deux fois** (un *job* planifié sur plusieurs
instances, le recalcul d'une entrée de cache, un import) : des cas où une rare double exécution
coûte un peu de travail perdu, et rien d'autre. Ne l'utilisez **pas** là où deux détenteurs
briseraient un invariant. Empêcher une double réservation, un double paiement ou un numéro de
facture en double relève d'une contrainte de la base de données (un index unique, une contrainte
d'exclusion, la version optimiste de l'agrégat), qui tient quoi que croie un processus à propos
d'un verrou.

```ts
// Au lieu de : un verrou comme garde d'un invariant.
const handle = await lock.acquire(`slot:${slotId}`, { ttlMs: 5_000 });
if (handle !== undefined && !(await bookings.existsForSlot(slotId))) {
  await bookings.save(booking); // deux détenteurs (une pause, une bascule) arrivent tous deux ici : réservé deux fois
}

// Écrivez : la base de données refuse la seconde réservation, quoi que croie un processus.
//   CREATE UNIQUE INDEX bookings_one_per_slot ON bookings (slot_id);
await bookings.save(booking); // la seconde insertion échoue sur l'index : le gestionnaire répond un refus
```

Le **jeton de clôture** (fencing token) croît à chaque acquisition d'une clé (`INCR`, dans le même
script que le `SET`). Une ressource qui stocke le plus grand jeton qu'elle a vu peut refuser une
écriture venue d'un détenteur périmé. Il réduit l'écart, pour les ressources capables de comparer ;
son compteur vit dans le même serveur et repart de zéro si ce serveur perd ses données : ce n'est
donc pas une preuve non plus.

<!-- checked sample -->
```ts
import type { Lock } from '@ddd-ts-kit/kernel';

declare const lock: Lock;
declare function buildReport(): Promise<string>;

/** En pratique, une colonne de la ligne écrite : ici, le plus grand jeton que le store a accepté. */
export class ReportStore {
  private highestToken = 0;

  private readonly reports: string[] = [];

  write(report: string, fencingToken: number): void {
    if (fencingToken < this.highestToken) {
      throw new Error(`Stale holder: token ${String(fencingToken)} after ${String(this.highestToken)}`);
    }

    this.highestToken = fencingToken;
    this.reports.push(report);
  }
}

export async function nightlyReport(store: ReportStore): Promise<void> {
  const handle = await lock.acquire('nightly-report', { ttlMs: 60_000 });

  if (handle === undefined) {
    return;
  }

  try {
    store.write(await buildReport(), handle.fencingToken);
  } finally {
    await handle.release();
  }
}
```

Le [guide du cache et de la coordination](../../docs/tools/cache-and-coordination.fr.md#ce-que-le-verrou-garantit-et-ce-quil-ne-garantit-pas)
dessine deux détenteurs d'une même clé, et la façon dont le jeton les distingue.

Un serveur absent fait rejeter `acquire` : on ne peut pas savoir si quelqu'un détient la clé, et
c'est l'appelant qui décide.

## Limiteur de débit

`RedisRateLimiter` implémente le port `RateLimiter` du noyau :

```ts
abstract class RateLimiter {
  abstract consume(key: string, limit: { limit: number; windowMs: number }): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }>;
}
```

Une fenêtre glissante : à tout instant, au plus `limit` appels autorisés pendant les `windowMs`
qui le précèdent. Un appel refusé n'est pas compté. `RedisRateLimiter` garde un ensemble trié
(sorted set) par clé, un membre par appel autorisé, et décide dans un seul script, si bien que des
appels concurrents venus de plusieurs instances ne peuvent pas prendre tous deux la dernière place.

![Une limite de trois appels par minute : les appels à 20, 30 et 45 secondes sont autorisés ; l'appel à 60 secondes voit trois appels dans sa fenêtre, il est refusé, non compté, et invité à réessayer dans 20 secondes ; l'appel à 82 secondes en voit deux et il est autorisé](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/redis-rate-limiter-sliding-window.fr.svg)

`remaining` compte les places qui restent une fois cet appel compté ; `retryAfterMs` vaut 0 pour
un appel autorisé et, pour un appel refusé, le temps qui reste avant que l'appel le plus ancien de
la fenêtre en sorte.

Devant la couche HTTP, avant que l'authentification ne coûte quoi que ce soit (avec Fastify ; les
trois mêmes lignes conviennent à un *middleware* Express) :

<!-- checked sample -->
```ts
// src/platform/http/rate-limit.ts
import Fastify from 'fastify';
import { RedisRateLimiter, type RedisConnection } from '@ddd-ts-kit/redis';

declare const redis: RedisConnection;

export const server = Fastify();
const limiter = new RedisRateLimiter(redis.client, { namespace: 'api', onError: 'allow' });

server.addHook('onRequest', async (request, reply) => {
  const decision = await limiter.consume(`ip:${request.ip}`, { limit: 120, windowMs: 60_000 });
  reply.header('RateLimit-Remaining', decision.remaining);

  if (decision.allowed) {
    return;
  }

  reply.header('Retry-After', Math.ceil(decision.retryAfterMs / 1000));
  return reply.code(429).send({ type: 'about:blank', title: 'Too Many Requests', status: 429, code: 'RATE_LIMITED' });
});
```

Un cas d'usage qui doit être limité pour une raison métier (trois réinitialisations de mot de
passe par heure) dépend du port `RateLimiter` du noyau et reçoit l'adaptateur par injection
(`builder.rebind(RateLimiter)`, montré sous [Cache](#cache)) ; `InMemoryRateLimiter` sur une
`FixedClock` est son *fake*. Le refus est une réponse métier, avec son code, pas un statut HTTP
écrit dans le cas d'usage :

<!-- checked sample -->
```ts
import { Command, ConceptError, FixedClock, InMemoryRateLimiter, RateLimiter, type CommandHandler } from '@ddd-ts-kit/kernel';

export class RequestPasswordReset extends Command {
  constructor(readonly accountId: string) {
    super();
  }
}

export class PasswordResetError extends ConceptError {
  static tooMany(retryAfterMs: number) {
    return PasswordResetError.refusal('PASSWORD_RESETS_EXHAUSTED', 'Three password resets per hour at most.', { retryAfterMs });
  }
}

export class RequestPasswordResetHandler implements CommandHandler<RequestPasswordReset> {
  constructor(private readonly limiter: RateLimiter) {}

  async execute({ accountId }: RequestPasswordReset): Promise<void> {
    const decision = await this.limiter.consume(`password-reset:${accountId}`, { limit: 3, windowMs: 3_600_000 });

    if (!decision.allowed) {
      throw PasswordResetError.tooMany(decision.retryAfterMs);
    }

    // envoyer le lien
  }
}

// Dans un test : le limiteur en mémoire sur une horloge fixe, et le temps avance quand le test le dit.
const clock = new FixedClock(new Date('2026-10-13T09:00:00Z'));
export const handler = new RequestPasswordResetHandler(new InMemoryRateLimiter(clock));
```

- **Exact, au prix de la mémoire.** Un membre par appel autorisé : une clé coûte de la mémoire en
  proportion de sa limite. Cela convient jusqu'à des milliers d'appels par fenêtre ; pour des
  dizaines de milliers, limitez une clé plus grossière ou une fenêtre plus courte.
- **L'horloge est celle de l'appelant.** Les instants viennent de la `Clock` donnée au limiteur
  (son option `clock`, l'horloge système par défaut), pas du serveur, si bien que chaque instance
  doit être synchronisée (NTP) : un décalage entre deux instances décale la fenêtre d'autant. En
  échange, le limiteur se teste sur une horloge fixe, et le script ne contient aucune arithmétique
  qui diffère d'une version de Lua à l'autre.
- **`onError`** : `throw` (par défaut) laisse l'appelant décider ; `allow` continue de servir sans
  limite pendant que le serveur est absent (le choix habituel devant une API) ; `deny` refuse tout
  (pour les rares limites qui sont un contrôle de sécurité, comme les tentatives de connexion).
- La clé expire d'elle-même une fenêtre après son dernier appel autorisé.

## Signal du relais

Un relais d'outbox interroge sa table à intervalles réguliers (polling). `RedisRelaySignal` lui
permet d'interroger rarement et de publier quand même tout de suite, entre processus : le
processus qui a validé une commande notifie, et un relais, dans n'importe quel autre processus, se
réveille.

<!-- checked sample -->
```ts
import { InMemoryCommandBus, SystemClock, unitOfWorkMiddleware, type IntegrationEventPublisher, type UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxRelay, type OutboxStore } from '@ddd-ts-kit/events';
import { RedisRelaySignal, relayWakeUpMiddleware, type RedisConnection } from '@ddd-ts-kit/redis';

declare const redis: RedisConnection;
declare const store: OutboxStore;
declare const publisher: IntegrationEventPublisher;
declare const unitOfWork: UnitOfWork;

const signal = new RedisRelaySignal(redis.client, { channel: 'app:outbox' });

// Le worker qui relaie : il se réveille sur une notification, et interroge quand même toutes les 5 s.
export const relay = new OutboxRelay({ store, publisher, clock: new SystemClock(), wakeOn: signal });
relay.start({ intervalMs: 5_000 });

// Le processus de l'API. Au lieu de `.use(unitOfWorkMiddleware(unitOfWork)).use(relayWakeUpMiddleware(signal))`,
// qui notifie dans la transaction, avant que l'enregistrement soit visible, placez le réveil en premier :
// il est alors le middleware extérieur, et notifie une fois l'unité de travail validée.
export const commandBus = new InMemoryCommandBus().use(relayWakeUpMiddleware(signal)).use(unitOfWorkMiddleware(unitOfWork));
```

Il satisfait structurellement le port `RelaySignal` de `@ddd-ts-kit/events` : ce *package* ne
dépend pas de `@ddd-ts-kit/events`, donc la classe ne nomme pas le port, et elle est acceptée
partout où un `RelaySignal` est attendu, `builder.bind(RelaySignal).toValue(signal)` compris. Elle
a la sémantique du signal en mémoire : **un indice, jamais une livraison**. La
publication-abonnement (publish/subscribe) ne garde rien pour un abonné absent ; une notification
envoyée pendant que le relais se reconnecte, ou avant qu'il se soit abonné, est perdue, et
l'événement part à l'interrogation suivante. Gardez un vrai `intervalMs`. `notify()` ne lève
jamais d'exception. `close()` ferme la connexion d'écoute que le signal a ouverte.

`relayWakeUpMiddleware` notifie après chaque commande qui a réussi, qu'elle ait publié ou non : un
réveil inutile coûte au relais une prise vide. Avec PostgreSQL, `LISTEN/NOTIFY` depuis la table de
l'outbox fait la même chose sans autre serveur.

## Bus d'événements sur Redis Streams

`RedisStreamsEventBus` est un fournisseur d'événements d'intégration : un `EventBus` du noyau qui
publie avec `XADD` et ne se résout que lorsque le serveur a acquitté chaque entrée, pour que le
relais de l'outbox puisse marquer un enregistrement comme publié, et qui consomme par un groupe de
consommateurs (consumer group) par consommateur, avec une lecture bloquante sur une connexion
dédiée, un acquittement après le gestionnaire, un nombre borné de relivraisons différées et un
flux de rejet (dead stream). Il se range à côté des fournisseurs RabbitMQ, Kafka et NATS, passe
`eventBusContract` de `@ddd-ts-kit/testing`, et tourne sans changement sur Redis, Dragonfly et
Valkey.

```
npm i @ddd-ts-kit/redis @ddd-ts-kit/events ioredis
```

**Quand le choisir.** Vous faites déjà tourner et exploitez Redis, Dragonfly ou Valkey, le volume
est modéré (les gestionnaires d'un flux s'exécutent un par un dans chaque instance), et un serveur
de plus à exploiter vaut la peine d'être évité. Vous obtenez des groupes de consommateurs, la
relivraison, des files de rejet (dead letters) et un journal lisible, avec une seule dépendance.
Choisissez RabbitMQ quand vous voulez un *broker* qui maîtrise la livraison (confirmations de
publication écrites sur disque, files quorum répliquées avant la confirmation, routage message par
message), et Kafka quand vous voulez un journal durable et répliqué, avec des partitions, un ordre
par clé et une longue rétention. Ici, la durabilité est celle pour laquelle le serveur est
configuré, et la rétention est bornée par la mémoire : voir
[Garanties et limites](#garanties-et-limites).

### Racine de composition

Les gestionnaires ne voient jamais ce *package*. Ils publient dans l'outbox ; le relais publie
dans les flux ; chaque contexte consommateur s'abonne par le bus, sous son propre nom.

![Le relais de l'outbox prend les enregistrements en attente dans la table de l'outbox et les publie avec XADD dans un seul MULTI ; chaque type d'événement a un flux ; chaque nom de consommateur y a son propre groupe, notifications et billing, qui reçoivent tous deux chaque événement ; les instances de billing se partagent ses entrées ; une entrée en échec ou empoisonnée va dans le flux de rejet de billing](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/redis-streams-topology.fr.svg)

<!-- checked sample -->
```ts
// main.ts
import { Command, SystemClock, type CommandBus, type Logger, type Metrics, type ProcessedEventStore, type UnitOfWork } from '@ddd-ts-kit/kernel';
import {
  OutboxPublisher,
  OutboxRelay,
  consume,
  subscribeAll,
  validatingPublisher,
  type EventRegistry,
  type IntegrationEventDefinition,
  type OutboxStore,
} from '@ddd-ts-kit/events';
import { RedisStreamsEventBus } from '@ddd-ts-kit/redis/event-bus';
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';

declare const config: { readonly redisUrl: string };
declare const logger: Logger;
declare const metrics: Metrics;
declare const outboxStore: OutboxStore;
declare const registry: EventRegistry;
declare const processed: ProcessedEventStore;
declare const unitOfWork: UnitOfWork;
declare const commandBus: CommandBus;
declare const orderPlaced: IntegrationEventDefinition<{ readonly orderId: string }>;
declare class IssueInvoice extends Command {
  constructor(orderId: string);
}

const deliveries = metrics.counter('event_deliveries_total');

const bus = new RedisStreamsEventBus({
  connection: config.redisUrl, // ou des options ioredis, ou un client que vous avez déjà (redis.client)
  prefix: 'integration-events', // la valeur par défaut : un flux par type, `<prefix>:<type>`
  retry: { maxAttempts: 5, delayMs: 5_000 }, // les valeurs par défaut
  visibilityTimeoutMs: 60_000, // la valeur par défaut : au-dessus du pire cas d'un lot de gestionnaires
  batchSize: 10, // la valeur par défaut
  onFailure: (failure) => logger.warn('event bus failure', { ...failure }), // des codes seulement, jamais un message d'erreur
  onDelivery: ({ stream, consumer, outcome }) => deliveries.increment({ stream, consumer, result: outcome }),
});

// Côté publication : les gestionnaires écrivent dans l'outbox, dans la transaction de la commande.
export const publisher = validatingPublisher(new OutboxPublisher(outboxStore), registry);

// La cible du relais est le bus. Un enregistrement est marqué publié quand le serveur a répondu l'identifiant de son entrée.
const relay = new OutboxRelay({ store: outboxStore, publisher: tracedPublisher(bus), clock: new SystemClock() });
relay.start({ intervalMs: 500 });

// Côté consommation : un abonné par contexte consommateur, qui porte son nom.
const billingEvents = tracedSubscriber(bus.forConsumer('billing'));
subscribeAll(billingEvents, [
  consume(orderPlaced, { consumer: 'billing.ordering-order-placed', processed, unitOfWork }, async (event) => {
    await commandBus.execute(new IssueInvoice(event.payload.orderId));
  }),
]);

await bus.assertTopology(); // échouer au démarrage, pas au premier événement

process.on('SIGTERM', async () => {
  await relay.stop(); // le tour en cours se termine
  await bus.close(); // les lecteurs s'arrêtent, le lot en cours se termine et acquitte
});
```

- `publish(events)` envoie le lot comme un seul `MULTI` de `XADD`, et ne se résout que lorsque le
  serveur a répondu un identifiant d'entrée pour **chaque** événement. Sinon, il rejette
  (`PUBLISH_NOT_CONFIRMED` avec l'`eventId` et un code `reason`, `BROKER_UNAVAILABLE`,
  `EVENT_BUS_CLOSED`). Rien n'est mis en tampon pour plus tard : l'outbox est le tampon.
- Un nom de consommateur est requis pour s'abonner : `bus.forConsumer('billing')` donne un
  `IntegrationEventSubscriber` pour un contexte (un monolithe modulaire en a plusieurs, chacun avec
  sa propre connexion de lecture), et l'option `consumer` nomme celui pour lequel travaille
  `bus.subscribe` (un service qui est un seul contexte).
- Avec `@ddd-ts-kit/di`, les gestionnaires d'événements d'intégration déclarés d'un contexte sont
  abonnés sur `EventSubscribers.forContext(<module name>)`. Donnez-lui le bus, et chaque contexte
  lit sous son propre nom :

  ```ts
  import { EventSubscribers } from '@ddd-ts-kit/kernel';

  const app = createApplication({
    modules: [
      kernelModule({ eventSubscribers: () => ({ forContext: (name) => bus.forConsumer(name) }) }),
      contextModule('billing', billingDeclarations),
    ],
  });

  // ou, depuis un module ultérieur
  builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
  ```
- Les *wrappers* de traçage fonctionnent comme avec tout fournisseur (avec `@ddd-ts-kit/di`, le
  côté consommation est tracé par `kernelModule({ instrumentation: traceApplication() })` et
  `tracedSubscriber` est laissé de côté) : le bus transporte `traceparent` et `correlationId`
  intacts, dans l'enveloppe et comme champs de l'entrée, y compris à travers une nouvelle
  tentative. À côté de l'événement, chaque gestionnaire reçoit la livraison (`EventDelivery` du
  noyau) : `{ attempt, maxAttempts, system: 'redis', destination, consumer }`, où `destination`
  est le flux. `@ddd-ts-kit/tracing` la lit pour faire un *span* CONSUMER par tentative ; le bus se
  nomme `messagingSystem: 'redis'`.
- La corrélation fait l'aller-retour. Publiez par `scopedPublisher(publisher, scope)` du noyau et
  consommez avec `consume(definition, { ..., scope }, handler)` : le consommateur s'exécute dans un
  contexte d'exécution dont le `correlationId` est celui de la requête qui a publié, dont le
  `causationId` est l'événement, et une relivraison s'exécute dans le même contexte. Ou donnez au
  bus l'option `scope` : chaque gestionnaire s'exécute alors à l'intérieur, sous le nom de son
  consommateur.
- Un contexte extrait dans son propre service garde son nom de consommateur, donc ses groupes :
  rien ne change sur le serveur.
- La connexion de publication est celle que vous donnez, partagée avec les autres adaptateurs de
  ce *package* si vous remettez `redis.client`. Chaque nom de consommateur lit sur un double de
  cette connexion (`client.duplicate()`), parce qu'une lecture bloquante occupe sa connexion.
  `close()` ferme ce que le bus a ouvert et laisse ouvert un client qu'on lui a remis.

| Option | Défaut | Effet |
|---|---|---|
| `connection` | requis | URL, options ioredis ou client. Une connexion ouverte ici prend `FAIL_FAST` et un délai de reconnexion tiré de `reconnect` |
| `prefix`, `streamOf` | `integration-events` | le flux d'un type est `<prefix>:<type>`, ou ce que répond `streamOf(type)` |
| `consumer` | aucun | le consommateur pour lequel lit `bus.subscribe` |
| `instance` | hôte, identifiant de processus, suffixe aléatoire | le nom de ce processus dans ses groupes ; unique par processus |
| `batchSize` | 10 | entrées lues à la fois par flux (`COUNT`), puis traitées dans l'ordre, une par une |
| `blockMs` | 1000 | combien de temps une lecture attend (`BLOCK`) : cela borne `close()` et la précision du délai avant une nouvelle tentative |
| `retry` | 5 tentatives, 5000 ms | les livraisons avant le flux de rejet, et l'attente après un échec |
| `visibilityTimeoutMs` | 60000 | temps d'inactivité après lequel les entrées en attente d'une autre instance sont reprises ; jamais moins que `retry.delayMs` |
| `startFrom` | `new` | où commence un groupe que ce bus crée : ce qui est publié à partir de ce moment, ou `beginning` pour tout le flux |
| `retention` | aucune | `{ maxLength }` ou `{ maxAgeMs }` : élagage appliqué par chaque publication. Voir les limites |
| `deduplication` | aucune | `{ windowMs }` : la garde côté publication décrite plus bas |
| `scope` | aucune | une `ExecutionScope` dans laquelle s'exécute chaque gestionnaire |
| `reconnect` | 200 ms, doublé jusqu'à 30 s | délai entre les reconnexions, et entre les tentatives d'un lecteur qui échoue |

### Topologie

`bus.describeTopology()` renvoie les flux et les groupes sous forme de données, pour une revue ou
un document généré ; `bus.assertTopology()` les crée, de façon idempotente. Le bus crée aussi ses
groupes avant de lire ou de publier, et de nouveau après tout échec d'un lecteur (un serveur
revenu sans ses données les a perdus). Pour `forConsumer('billing')` abonné à
`ordering.order.placed` :

| Objet | Nom | Propriétés |
|---|---|---|
| flux d'événements | `integration-events:ordering.order.placed` | un par type d'événement, partagé par tous les consommateurs ; créé vide par le premier groupe (`MKSTREAM`) ou par la première publication |
| groupe de consommateurs | `billing`, sur ce flux | un par nom de consommateur ; détient sa position et ses entrées en attente ; créé à `$` (ou à `0` avec `startFrom: 'beginning'`) |
| membre du groupe | le nom `instance` | un par processus ; retiré à `close()` quand il ne laisse rien en attente |
| flux de rejet | `integration-events:ordering.order.placed:billing:dead` | un par consommateur et par type, créé par la première entrée rejetée ; aucun groupe ne le lit |

Une entrée contient l'enveloppe en JSON dans le champ `envelope` (`id`, `type`, `version`,
`occurredAt`, `payload`, `traceparent`, `correlationId`, `tenantId`) et, à côté, les champs `id`,
`type`, `version`, `traceparent`, `correlation-id` et `tenant-id` : un opérateur les lit avec
`XRANGE` sans analyser le corps, et n'importe quel client du protocole peut consommer le flux.

Deux consommateurs d'un même type ont chacun un groupe, et reçoivent tous deux chaque événement.
Deux instances d'un même consommateur sont deux membres de son groupe : chaque événement va à
l'une d'elles.

**Ordre.** Une instance reçoit les événements d'un type dans l'ordre du flux, qui est l'ordre dans
lequel le serveur les a reçus. Cet ordre est rompu par une relivraison (l'événement en échec
revient après que des événements ultérieurs ont été traités) et par des instances concurrentes
(deux membres d'un groupe progressent indépendamment l'un de l'autre). Il n'y a pas d'ordre entre
types, ni par agrégat : portez une version dans le contenu de l'événement (payload) quand cela
compte.

### Comportement des nouvelles tentatives et de la file de rejet

![Une entrée livrée avec la tentative n : sans enveloppe, elle va dans le flux de rejet comme entrée empoisonnée ; au-delà de retry.maxAttempts, après que ses instances ont planté sur elle, dans le flux de rejet comme ATTEMPTS_EXHAUSTED ; sinon chaque gestionnaire de son type s'exécute ; s'ils se sont tous résolus, elle est acquittée ; si l'un a levé une exception à la dernière tentative, elle est copiée dans le flux de rejet et acquittée en un seul script ; sinon elle reste en attente et elle est reprise après retry.delayMs ; une autre instance reprend les entrées d'une instance plantée après visibilityTimeoutMs](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/redis-streams-retry-and-dead-letter.fr.svg)

1. Une entrée est acquittée (`XACK`) après que chaque gestionnaire abonné à son type s'est résolu.
   Utilisez `consume` de `@ddd-ts-kit/events` : l'acquittement suit alors la validation (commit)
   de l'unité de travail, et une relivraison est dédupliquée.
2. Quand un gestionnaire lève une exception, l'entrée n'est pas acquittée : elle reste dans la
   liste des entrées en attente (pending entry list) du groupe, détenue par cette instance, et son
   temps d'inactivité repart de zéro à l'échec. Une fois qu'elle est inactive depuis
   `retry.delayMs`, l'instance la reprend (`XPENDING` avec `IDLE`, puis `XCLAIM`). Une entrée en
   échec n'est jamais retraitée sur-le-champ : pas de boucle effrénée (hot loop).
3. Le numéro de tentative est le compteur de livraisons que le serveur tient dans la liste des
   entrées en attente : 1 à la première lecture, incrémenté à chaque reprise. À la
   `retry.maxAttempts`-ième livraison en échec, l'entrée est copiée dans le flux de rejet avec
   `dead-reason: max-attempts`, `error-code`, `attempt`, `consumer` et `entry-id` (son identifiant
   dans le flux d'événements), et acquittée, en un seul script : jamais l'un sans l'autre.
4. Les entrées en attente d'une instance qui est morte, ou bloquée, sont reprises par une autre
   instance du consommateur une fois inactives depuis `visibilityTimeoutMs`. Cette livraison compte
   comme une tentative. Une entrée qui a épuisé toutes ses tentatives de cette façon, sans qu'aucun
   gestionnaire ait jamais répondu, va dans le flux de rejet avec `error-code: ATTEMPTS_EXHAUSTED`
   sans être traitée de nouveau : un événement qui tue ses consommateurs ne les tue pas
   indéfiniment.
5. Une entrée qui ne contient pas d'enveloppe (pas de champ `envelope`, illisible, ou sans `id`,
   `type`, `version`, `occurredAt`) est empoisonnée (poison) : elle va directement dans le flux de
   rejet avec `dead-reason: poison` et `error-code: POISON_ENTRY`, et aucun gestionnaire ne la
   voit.
6. Seuls les codes voyagent : `error-code` est le `code` de l'erreur, ou le nom de sa classe. Le
   message d'une erreur n'est jamais journalisé, remonté ni joint, parce qu'il peut citer des
   données du contenu de l'événement.

La livraison se fait au moins une fois. Un acquittement perdu lors d'une déconnexion, une reprise
en concurrence avec un gestionnaire lent, une nouvelle tentative du relais : chacun livre un
événement deux fois, jamais zéro fois.

Quand la connexion est perdue, ioredis se reconnecte avec le délai de `reconnect` ; `publish`
rejette aussitôt entre deux tentatives (`BROKER_UNAVAILABLE`), si bien que le relais de l'outbox
garde les enregistrements et les retente, et les lecteurs reprennent là où en sont leurs groupes.
Les entrées qui étaient en cours de traitement restent en attente et sont reprises.

### Publier deux fois

Redis Streams n'offre **aucune déduplication côté publication** : un `XADD` qui a réussi mais dont
la réponse a été perdue est ajouté de nouveau par la nouvelle tentative du relais, et les deux
entrées sont livrées. La réponse est la même que pour tout fournisseur : le consommateur
déduplique, avec un store d'événements traités dans la transaction de son gestionnaire
(`consume`).

Une garde peu coûteuse réduit la fenêtre, en option :

```ts
new RedisStreamsEventBus({ connection, deduplication: { windowMs: 3_600_000 } });
```

Chaque événement est alors ajouté par un script qui cherche d'abord la clé
`<stream>:<event id>:published`, n'ajoute l'entrée que si la clé est absente, et l'écrit avec la
fenêtre comme durée de vie. Une nouvelle tentative du relais dans la fenêtre n'ajoute rien et
reçoit un acquittement. C'est une garde, pas une garantie : la marque est une clé de plus, évincée
ou perdue avec le serveur comme n'importe quelle autre, et elle coûte une clé par événement pendant
toute la fenêtre. Les consommateurs dédupliquent toujours. Vérifié sur Dragonfly v2.0.2, Valkey
9.1.2 et Redis 8.10.2. (Redis 8.10.2 annonce un ajout idempotent côté serveur dans
`XINFO STREAM` ; il n'est pas utilisé, les deux autres serveurs ne l'ont pas.)

### Exploitation

Ce qu'il faut surveiller, avec les commandes de n'importe quel client (`<stream>` est
`<prefix>:<type>`) :

| Signal | Commande | Signification |
|---|---|---|
| `stats()` de l'outbox (`pending`, `failed`, `dead`) | le store de l'outbox | le côté publication : voir `@ddd-ts-kit/events` |
| retard d'un consommateur | `XINFO GROUPS <stream>` : `lag`, `last-delivered-id` | les entrées pas encore lues : le consommateur est en retard ou arrêté |
| entrées en attente | `XINFO GROUPS <stream>` : `pending` ; le détail avec `XPENDING <stream> <consumer> - + 10` (propriétaire, temps d'inactivité, livraisons) | en cours de traitement, ou en attente d'une relivraison ; un plateau signale un gestionnaire qui échoue sans cesse, un temps d'inactivité au-dessus du délai de visibilité signale que personne ne lit |
| profondeur du flux de rejet | `XLEN <stream>:<consumer>:dead` | doit valoir 0 : alertez sur toute autre valeur |
| ce qui est mort, et pourquoi | `XRANGE <stream>:<consumer>:dead - + COUNT 10` : `error-code`, `dead-reason`, `attempt` | le code à chercher dans les journaux du consommateur |
| membres d'un groupe | `XINFO CONSUMERS <stream> <consumer>` | les instances ; une instance qui a planté reste listée jusqu'à ce qu'on la retire |
| mémoire d'un flux | `XLEN <stream>`, `MEMORY USAGE <stream>` | un flux ne fait que grandir tant qu'il n'est pas élagué |
| `onDelivery` compté par `outcome` | ce bus | le taux de `retried`, `dead`, `poison` par rapport à `acknowledged` |
| `onFailure` avec `kind: 'connection'` | ce bus | les reconnexions (`CONNECTION_LOST`, `ECONNREFUSED`) et ce que le serveur a refusé à un lecteur (`REDIS_NOGROUP`) |
| `bus.deliveriesInFlight` | ce bus | les entrées lues et pas encore réglées ; bloqué au-dessus de 0, il signale un gestionnaire qui ne rend pas la main |

`onFailure` ne dit que des codes. Pour remonter un événement que le bus abandonne avec l'erreur que
son gestionnaire a réellement levée, comme le fait l'application d'exemple, remettez le *hook* à
`DeadLetterReports` du noyau et abonnez-vous à travers lui : une livraison qui échoue puis est
retentée n'est pas remontée, une entrée morte ou empoisonnée l'est.

<!-- checked sample -->
```ts
import { DeadLetterReports, type ErrorReporter } from '@ddd-ts-kit/kernel';
import { RedisStreamsEventBus } from '@ddd-ts-kit/redis/event-bus';

declare const config: { readonly redisUrl: string };
declare const errors: ErrorReporter;

const deadLetters = new DeadLetterReports(errors);

export const bus = new RedisStreamsEventBus({
  connection: config.redisUrl,
  onFailure: (failure) => deadLetters.onFailure(failure),
});

// Retient ce que chaque gestionnaire a levé, jusqu'à ce que onFailure dise si l'événement a été abandonné.
export const billingEvents = deadLetters.observing(bus.forConsumer('billing'));
```

Rejouer les entrées mortes, une fois la cause corrigée :

<!-- checked sample -->
```ts
import { streamNamesOf, type RedisStreamsEventBus } from '@ddd-ts-kit/redis/event-bus';

declare const bus: RedisStreamsEventBus;

const billing = { consumer: 'billing', type: 'ordering.order.placed' };

// Les clés à lire d'abord, avec XLEN et XRANGE : le flux d'événements et le flux de rejet de billing.
export const { events, dead } = streamNamesOf(billing); // avec le préfixe par défaut ; passez `streamOf` sinon

// Jusqu'à 100 entrées renvoyées vers le flux d'événements, les plus anciennes d'abord, pour billing seulement.
export const replayed = await bus.replayDead(billing, 100);
```

Il déplace jusqu'à ce nombre d'entrées, les plus anciennes d'abord, du flux de rejet vers le flux
d'événements, chacune en un seul script (ajoutée, puis supprimée du flux de rejet). La nouvelle
entrée a un budget de tentatives neuf et porte `replay-for: billing` : les autres consommateurs du
type l'acquittent sans la traiter. Un client à vous qui lit le flux doit ignorer une entrée dont
`replay-for` nomme quelqu'un d'autre. Regardez d'abord `dead-reason` et `error-code` : rejouer une
entrée empoisonnée ne fait que la tuer de nouveau.

Entretien :

- Un consommateur arrêté pour de bon : `XGROUP DESTROY <stream> <consumer>`, et supprimez son flux
  de rejet. Se désabonner ne fait qu'arrêter la lecture ; le groupe garde sa position, et son
  retard grandit.
- Une instance qui a planté reste membre de ses groupes. Ses entrées en attente sont reprises après
  le délai de visibilité ; retirez son nom avec
  `XGROUP DELCONSUMER <stream> <consumer> <instance>` une fois que `XINFO CONSUMERS` la montre avec
  0 entrée en attente (supprimer un membre abandonne ses entrées en attente).
- Élaguer à la main, quand aucune `retention` n'est configurée : `XTRIM <stream> MINID ~ <id>`
  avec un identifiant que chaque groupe a dépassé (`last-delivered-id` de `XINFO GROUPS`) et rien
  en attente en dessous.

### Garanties et limites

- **La durabilité est celle du serveur, et c'est un réglage.** Une entrée est acquittée quand le
  serveur la détient en mémoire. Ce qui survit à un plantage dépend de la persistance : avec Redis
  ou Valkey et `appendonly yes`, `appendfsync everysec` (le réglage habituel) peut perdre environ
  la dernière seconde d'entrées acquittées, et `always` aucune, au prix d'un coût sur chaque
  écriture ; avec des *snapshots* seulement (RDB, et Dragonfly, qui persiste par *snapshots*),
  tout ce qui suit le dernier *snapshot* est perdu ; sans persistance, un redémarrage repart à
  vide. La réplication est asynchrone : une bascule (failover) peut perdre ce que la réplique
  n'avait pas reçu. Pour un journal d'événements, cela veut dire qu'un événement que le relais a
  marqué publié peut disparaître, et qu'aucun consommateur ne le verra jamais. Un *broker* qui
  confirme après avoir écrit dans un journal répliqué n'a pas cette fenêtre. Décidez si vos
  événements la tolèrent, réglez la persistance en conséquence, et ne purgez pas les
  enregistrements publiés de l'outbox avant l'horizon de vos sauvegardes.
- **Les positions sont dans le même serveur.** Les groupes, les entrées en attente et les
  compteurs de livraisons sont perdus ou ramenés en arrière avec les données. Un serveur restauré
  depuis un *snapshot* plus ancien livre de nouveau ce qui a été traité depuis (les consommateurs
  dédupliquent) ; un serveur qui a tout perdu voit ses groupes recréés à la fin de flux vides.
- **Aucune déduplication côté publication**, comme dit plus haut.
- **La rétention est bornée par la mémoire.** Un flux vit en mémoire, tout entier. Par défaut, rien
  n'est élagué. `retention: { maxLength }` (`MAXLEN ~`) et `retention: { maxAgeMs }` (`MINID ~`,
  selon l'horloge du processus qui publie) élaguent à chaque publication, approximativement, et **sans égard
  pour les groupes** : une entrée qu'aucun consommateur n'a encore lue, ou qui attend sa
  relivraison, est supprimée avec le reste et quitte en silence la liste des entrées en attente à
  sa reprise suivante. Dimensionnez le plafond bien au-dessus du pire retard que vous acceptez, ou
  élaguez à la main. Les flux de rejet ne sont jamais élagués.
- **L'éviction s'applique à tout.** Sous `allkeys-*`, un flux entier peut être évincé. Faites
  tourner le bus d'événements sur un serveur en `noeviction` (une publication échoue alors quand la
  mémoire est pleine, et le relais retente), pas sur celui qui vous sert de cache.
- **Un à la fois, par flux et par instance.** Le débit est celui de vos gestionnaires exécutés en
  séquence ; montez en charge avec des instances, au prix de l'ordre. Les types sont traités en
  parallèle à l'intérieur d'un lot, mais un tour se termine quand son flux le plus lent se termine.
- **Le délai de visibilité doit dépasser le pire cas d'un lot** (`batchSize` fois le gestionnaire
  le plus lent) : au-delà, une autre instance reprend les entrées pendant que la première travaille
  encore, et elles sont traitées deux fois. Avec des gestionnaires lents, baissez `batchSize`.
- **Un seul délai.** La même attente avant chaque nouvelle tentative, sans temporisation
  exponentielle (exponential backoff), précise à `blockMs` près. Une entrée en échec dont
  l'instance s'arrête est retentée par une autre instance après le délai de visibilité, pas après
  le délai de nouvelle tentative.
- **Une relivraison exécute de nouveau chaque gestionnaire du type**, y compris ceux qui ont
  réussi, quand plusieurs gestionnaires d'un même consommateur s'abonnent au même type. Chacun doit
  être idempotent.
- **Un lot est une transaction sur un serveur** : toutes ses entrées sont ajoutées, ou la
  publication rejette. Un rejet ne prouve pas que rien n'a été ajouté (la réponse a pu être
  perdue) ; le relais retente et les consommateurs dédupliquent.
- **Un nouveau groupe commence à la fin du flux** par défaut : ce qui a été publié avant qu'un
  consommateur s'abonne pour la première fois ne lui est pas livré. `startFrom: 'beginning'` lit
  ce que le flux contient encore.
- **Un abonnement ajouté pendant que le consommateur lit** est lu à partir du tour suivant, jusqu'à
  `blockMs` plus tard. Rien n'est manqué : son groupe existe avant que le bus publie.
- **Un serveur, ou un primaire avec des répliques.** Une lecture couvre les flux d'un consommateur
  en une seule commande, et une entrée rejetée touche deux clés en un seul script : sur un Redis
  Cluster, les clés doivent partager un *slot*, ce que donne un `prefix` entre accolades
  (`{events}`). Pas testé sur un cluster.
- **Un processus qui a planté laisse son nom** dans ses groupes, et une marque de déduplication par
  événement pour la durée de la fenêtre, quand la garde est active : voir l'entretien plus haut.

## Ce qui n'est pas ici : un store d'événements traités

Il n'y a délibérément pas de `RedisProcessedEventStore`. L'idempotence d'un consommateur ne tient
que si « cet événement a été traité » est validé **avec** le changement d'état qu'il représente
(`events/consumer-idempotent`). Une marque dans Redis et un changement dans PostgreSQL sont deux
systèmes : un plantage entre les deux soit perd l'événement (marque gardée, changement annulé),
soit le fait traiter deux fois. Utilisez le store de votre adaptateur de base de données
(`KnexProcessedEventStore`, `DrizzleProcessedEventStore`), dans l'unité de travail du
consommateur.

Le même raisonnement s'applique à l'outbox elle-même, et à tout ce qui doit être atomique avec les
données métier : cela vit dans la base de données.

## Compatibilité : les commandes utilisées

| Adaptateur | Commandes |
|---|---|
| `RedisCache` | `GET`, `SET` (avec `PX`), `DEL`, `SCAN` (avec `MATCH`, `COUNT`) |
| `RedisLock` | `EVAL` de deux scripts appelant `SET` (avec `NX`, `PX`), `INCR`, `GET`, `DEL` |
| `RedisRateLimiter` | `EVAL` d'un script appelant `ZREMRANGEBYSCORE`, `ZCARD`, `ZADD`, `PEXPIRE`, `ZRANGE` (avec `WITHSCORES`) |
| `RedisRelaySignal` | `PUBLISH`, `SUBSCRIBE` |
| `RedisStreamsEventBus`, publication | `MULTI`, `EXEC`, `XADD` (avec `MAXLEN ~` ou `MINID ~` sous `retention`) ; sous `deduplication`, `EVAL` d'un script appelant `GET`, `XADD`, `SET` (avec `PX`) |
| `RedisStreamsEventBus`, consommation | `XGROUP CREATE` (avec `MKSTREAM`), `XREADGROUP` (avec `GROUP`, `COUNT`, `BLOCK`, plusieurs flux), `XACK`, `XPENDING` (forme étendue, avec `IDLE` et avec un consommateur), `XCLAIM` (avec un temps d'inactivité minimal, et avec `JUSTID`), `XGROUP DELCONSUMER`, `EVAL` d'un script appelant `XADD`, `XACK` |
| `RedisStreamsEventBus`, `replayDead` | `XRANGE` (avec `COUNT`), `EVAL` d'un script appelant `XRANGE`, `XADD`, `XDEL` |
| `redisHealth`, `close` | `PING`, `QUIT` |
| ioredis lui-même, à la connexion | `HELLO 3` (ioredis 6 ; les réponses sont ramenées à leur forme classique), `INFO`, `CLIENT SETINFO`, et `AUTH`, `SELECT` quand l'URL le demande |

Les choix faits pour la portabilité :

- Les scripts sont envoyés avec `EVAL`, pas `EVALSHA` : aucun cache de scripts à préchauffer, ou à
  perdre derrière un proxy ou après une bascule. Ils font quelques lignes chacun.
- Chaque clé qu'un script touche est déclarée dans `KEYS` : Dragonfly refuse un script qui atteint
  une clé non déclarée (Valkey l'exécute), et un cluster a besoin des clés pour le routage. Les
  deux clés du verrou partagent un *hash tag* (`{key}`).
- Le Lua se limite aux commandes et aux comparaisons. Pas d'arithmétique sur les scores, pas de
  `redis.call('TIME')`, pas de `cjson`, pas de `redis.setresp` : Redis et Valkey embarquent Lua
  5.1, Dragonfly Lua 5.4, et ils diffèrent sur les nombres. Mesuré sur les deux serveurs
  ci-dessus : un script qui renvoie `10/4` répond `2` sur Valkey et `2.5` sur Dragonfly, et
  `tostring(10/2)` vaut `5` sur l'un et `5.0` sur l'autre.
- Pas de `KEYS`, pas de `UNLINK`, pas de notifications d'espace de clés (keyspace notifications),
  pas de modules, pas de fonctions. Les flux ne servent qu'au bus d'événements.
- Les scripts du bus d'événements passent un nombre variable de champs avec `unpack(ARGV, n)` et
  testent une réponse vide avec `#` : les deux se comportent de la même façon sous Lua 5.1 et 5.4,
  ce qui a été vérifié sur les trois serveurs. Une entrée rejetée passe par un script, pas par un
  `MULTI` : une transaction acquitterait l'entrée même si sa copie dans le flux de rejet avait
  échoué.
- Les relivraisons utilisent `XPENDING` puis `XCLAIM`, pas `XAUTOCLAIM`. `XAUTOCLAIM` fonctionne
  sur les trois serveurs, mais ne répond aucun compteur de livraisons, et les nouvelles tentatives
  bornées en ont besoin.
- La lecture bloquante passe par la commande nommée d'ioredis (`client.xreadgroup`), jamais par
  `client.call('XREADGROUP')` : sous RESP3, que parle ioredis 6, seules les commandes qu'il connaît
  voient leur réponse ramenée à la forme classique.
- `deleteByPrefix` supprime une clé par `DEL`, puisqu'un cluster refuse un `DEL` dont les clés
  vivent dans des *slots* différents.

Ce qui diffère entre les serveurs, pour ce qui concerne le bus d'événements, et qui est absorbé :

- `XREADGROUP` sur plusieurs flux répond pour chaque flux sur Dragonfly, avec une liste vide pour
  ceux qui n'ont pas de nouvelle entrée ; Redis et Valkey les omettent.
- Une commande sur un flux qui n'existe plus est refusée comme `NOGROUP` par Redis et Valkey ;
  Dragonfly répond `ERR no such key` à `XPENDING`. Dans les deux cas, le lecteur recrée ses
  groupes ; le code remonté est `REDIS_NOGROUP` ou `REDIS_ERR`.
- Une lecture bloquante vide a duré son temps de `BLOCK` sur Dragonfly et Redis, et a été mesurée
  à environ 100 ms de plus sur Valkey.

Testé contre Dragonfly v2.0.2, Valkey 9.1.2 et Redis 8.10.2 avec ioredis 6 : même suite, mêmes
résultats. La suite a besoin d'un serveur et elle est ignorée sans `DDD_TS_KIT_TEST_REDIS_URL` :

```
docker run -d --rm --name ddd-ts-kit-test-redis -p 127.0.0.1:6390:6379 docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2
DDD_TS_KIT_TEST_REDIS_URL=redis://127.0.0.1:6390 npx vitest run packages/redis
```

Les *specs* écrivent sous un espace de noms aléatoire par test et ne vident jamais le serveur.
Celles du bus d'événements exécutent la suite de contrat (avec ses valeurs par défaut, puis avec la
garde de publication et des flux plafonnés), les comportements du fournisseur (publication
acquittée coupée en plein vol, relivraison, passage en file de rejet, rejeu, entrée empoisonnée,
consommateurs concurrents et distincts, reprise après le délai de visibilité, groupes perdus puis
recréés, reconnexion à travers un relais TCP que le test coupe, fermeture propre) et toute la
chaîne, de l'outbox jusqu'à un consommateur idempotent. Chaque test travaille sous un préfixe qui
lui est propre, et supprime ses clés.

## Store de *jobs* en arrière-plan

`RedisJobStore` est le `JobStore` de `@ddd-ts-kit/scheduling` sur Redis, Dragonfly ou Valkey,
pour un projet sans base de données, ou qui veut garder sa file d'attente hors de sa base :
quelques scripts Lua sur le client du *package*, chaque clé sous `{<namespace>}`, pour qu'un
cluster les garde dans un seul *slot* et que Dragonfly voie déclarée chaque clé qu'un script
touche.

<!-- checked sample -->
```ts
import type { ErrorReporter, Logger } from '@ddd-ts-kit/kernel';
import { kernelModule } from '@ddd-ts-kit/di';
import { RedisJobStore, reportLostJobs, type RedisConnection } from '@ddd-ts-kit/redis';

declare const redis: RedisConnection;
declare const logger: Logger;
declare const errors: ErrorReporter;

const jobStore = new RedisJobStore(redis.client, { namespace: 'jobs', onLostJob: reportLostJobs(logger, errors) });

export const kernel = kernelModule({ jobStore });
```

`reportLostJobs(logger, errors?)` journalise une écriture perdue après la validation de son unité
de travail (l'identifiant du *job*, la classe et le code de l'erreur) et remet l'erreur à
l'`ErrorReporter`, avec l'origine `queue` ; un projet initialisé avec `--queue redis` l'a lié par
son module de plateforme.

Redis ne peut pas rejoindre la transaction d'une base de données. Dans une unité de travail,
`add`, `cancel` et `retryDead` répondent d'après ce que Redis contient, et écrivent une fois
l'unité validée (`whenCommitted` du noyau) : une commande dont la transaction est annulée
(rollback) ne laisse aucun *job* et n'en annule aucun, mais un processus qui meurt entre la
validation et l'écriture perd cette écriture, et `onLostJob` est prévenu quand elle échoue. Avec
une base de données, préférez la table de *jobs* du *package* de votre ORM. La clé d'idempotence,
propre au *tenant* du *job*, est vérifiée avant que le *job* soit préparé, puis de nouveau quand il
est écrit : deux *jobs* de même clé préparés avant que l'un ou l'autre soit validé répondent
chacun leur propre identifiant, et seul le premier est gardé.

Pas de BullMQ : il apporterait un second modèle de *worker*, sur lequel le contrat du store
(prise, bail, signal de vie, rapports par tentative) ne se calque pas, et le mode cluster émulé
sur Dragonfly. Le store passe `jobStoreContract` sur Dragonfly dans le *job* d'intégration de la
CI ; il a aussi été lancé à la main sur Redis 8 (dernier passage : Dragonfly 2.0.2, Redis 8.2,
2026-10-13). Ce que garantissent les *jobs* : [Jobs en arrière-plan](../../docs/concepts/background-jobs.fr.md).

## Suites de contrat

Chaque port a une suite que son implémentation en mémoire et son adaptateur passent tous les deux.
Un adaptateur à vous (une autre bibliothèque cliente, un autre store) est tenu à la même :

<!-- checked sample -->
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, type Cache, type Clock, type Lock, type RateLimiter } from '@ddd-ts-kit/kernel';
import { cacheContract, lockContract, rateLimiterContract } from '@ddd-ts-kit/testing/contracts';

// Vos adaptateurs, sous test : chaque appel en répond un neuf.
declare function createMyCache(): Cache;
declare function createMyLock(): Lock;
declare function createMyLimiter(clock: Clock): RateLimiter;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const clock = new FixedClock(new Date('2026-10-13T09:00:00Z'));

const runner = { describe, it, expect, beforeEach };
cacheContract(runner, { name: 'MyCache', createCache: () => createMyCache(), elapse: (ms) => sleep(ms) });
lockContract(runner, { name: 'MyLock', createLock: () => createMyLock(), elapse: (ms) => sleep(ms) });
rateLimiterContract(runner, { name: 'MyLimiter', createLimiter: () => createMyLimiter(clock), elapse: (ms) => clock.advance(ms) });
```

`elapse` fait passer le temps pour le sujet du test : avancez l'horloge qu'il lit, ou attendez
réellement quand le temps est celui du serveur. Les suites vivent dans
`@ddd-ts-kit/testing/contracts`, avec celles des autres ports du noyau, où les implémentations en
mémoire du noyau sont exécutées contre elles ; `@ddd-ts-kit/redis/testing` les réexporte.

## Limites

- **Un serveur, ou un primaire avec des répliques.** Un Redis Cluster fonctionne pour le cache
  (une clé par commande) et pour le verrou (*hash tag*) ; `deleteByPrefix` devrait parcourir
  chaque nœud, ce qu'il ne fait pas. Pas testé sur un cluster.
- **L'éviction s'applique à tout.** Un serveur configuré pour évincer (`allkeys-lru`) peut évincer
  une clé de verrou ou de limite de débit aussi bien qu'une entrée de cache. Utilisez une politique
  `volatile-*`, ou un second serveur pour ce qui n'est pas un cache.
- **Pas de cache côté client, pas de *pipelining* des `get`** : chaque lecture est un aller-retour.
- **Les valeurs sont en JSON par défaut** : `undefined`, `Date`, `Map`, `bigint` et les instances
  de classe ne survivent pas. Donnez un codec, ou mettez en cache des données simples.
- **Le verrou n'est pas réentrant et il n'est pas renouvelé** : choisissez un `ttlMs` au-dessus du
  pire cas du travail, ou découpez le travail.
- **ioredis 5** est accepté comme *peer* ; les suites n'ont été exécutées qu'avec ioredis 6.
