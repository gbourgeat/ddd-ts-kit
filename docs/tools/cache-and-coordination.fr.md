[English](cache-and-coordination.md) · **Français**
<!-- translation-of: cache-and-coordination.md sha256:88053e78a497f063 -->

# Cache et coordination : Redis, Dragonfly, Valkey

**Résumé.** `@ddd-ts-kit/redis` implémente trois ports du noyau sur le protocole Redis : `Cache`,
`RateLimiter` et `Lock`, plus un signal de réveil pour le relais de l'outbox, un stockage des
*jobs* en arrière-plan et un bus d'événements sur Redis Streams
([brokers de messages](message-brokers.fr.md)). Il utilise un sous-ensemble commun de commandes,
si bien que le même code tourne sur Redis, Valkey et Dragonfly, et que le choix du serveur est
opérationnel et juridique (les trois ont des licences différentes), pas architectural. La partie
importante de cette page est ce que ces outils ne garantissent pas : un cache peut être périmé ou
absent, un limiteur de débit dépend d'horloges synchronisées, et le verrou est un outil
d'efficacité qui peut avoir deux détenteurs. Tout ce qui ne doit jamais arriver deux fois est
gardé par une contrainte de base de données.

## Trois rôles différents

| Port | Question à laquelle il répond | Ce que coûte une mauvaise réponse | Dans le domaine fil rouge |
|---|---|---|---|
| `Cache` | « ai-je calculé cela récemment ? » | une lecture plus lente ou un peu périmée | `availability` met en cache les horaires de travail d'un praticien, lus par une *gateway* |
| `RateLimiter` | « cet appelant a-t-il fait cela trop souvent ? » | quelques appels de trop, ou un appel refusé | 120 requêtes HTTP par minute et par adresse devant l'API ; trois tentatives de réservation par minute et par client |
| `Lock` | « quelqu'un d'autre fait-il déjà ce travail ? » | le travail fait deux fois | une seule instance exécute le *job* `notifications.send-reminders` pour une occurrence donnée |

Aucun ne répond à « ce créneau est-il encore libre ? ». C'est l'invariant « pas de double
réservation » d'`appointments`, et il est tenu par l'agrégat et par une contrainte de base de
données ([invariants, permissions et validation](../concepts/invariants-permissions-validation.fr.md)).

Les cas d'usage dépendent des ports du noyau ; l'adaptateur est choisi dans `src/platform/` et
lié à la racine de composition. `@ddd-ts-kit/redis` est refusé dans `domain/` et `application/`
même quand une liste d'autorisation le nomme (`layer/domain-purity`, `layer/application-inward`
dans [ARCHITECTURE.md](../ARCHITECTURE.fr.md)). Sans serveur, `kernelModule()` lie des
implémentations en mémoire, correctes pour un processus et pour les tests.

![Une gateway par l'aspect cached, une route ou un cas d'usage dont le débit est limité, et le planificateur de jobs dépendent des ports Cache, RateLimiter et Lock du noyau ; les adaptateurs en mémoire liés par kernelModule ou les adaptateurs de @ddd-ts-kit/redis les implémentent, ces derniers sur une connexion à Redis, Valkey ou Dragonfly](../assets/diagrams/cache-and-coordination-ports-and-adapters.fr.svg)

Passer d'une instance à plusieurs change la plateforme et rien d'autre. L'application d'exemple
lie les trois adaptateurs Redis sur une seule connexion, chacun sous son propre espace de noms,
comme le fait `src/platform/redis/open-redis.ts` :

<!-- checked sample -->
```ts
import { kernelModule } from '@ddd-ts-kit/di';
import { Metrics } from '@ddd-ts-kit/kernel';
import { RedisCache, RedisLock, RedisRateLimiter, connectRedis } from '@ddd-ts-kit/redis';

declare const redisUrl: string;

// redis://..., la même pour Redis, Valkey et Dragonfly. Les commandes expirent après deux secondes.
const redis = connectRedis(redisUrl);

// src/platform/ : les implémentations en mémoire de kernelModule() remplacées par des adaptateurs que toutes les instances partagent.
export const kernel = kernelModule({
  cache: (resolve) => new RedisCache(redis.client, { namespace: 'scheduling', metrics: resolve(Metrics) }),
  // Un serveur absent laisse passer les requêtes plutôt que de toutes les refuser.
  rateLimiter: new RedisRateLimiter(redis.client, { namespace: 'scheduling:rate', onError: 'allow' }),
  lock: new RedisLock(redis.client, { namespace: 'scheduling:lock' }),
});
```

## Les trois serveurs

Vérifié le 2026-10-10 sur le dépôt GitHub de chaque projet (dernière version publiée, fichier de
licence).

| | Redis | Valkey | Dragonfly |
|---|---|---|---|
| Dernière version publiée | 8.10.2 (2026-09-17) | 9.1.2 (2026-09-01) | 2.0.2 (2026-10-07) |
| Licence | depuis Redis 8 : au choix RSALv2, SSPLv1 ou AGPLv3 ; la 7.2 et les précédentes étaient sous BSD 3-clause | BSD 3-clause | Business Source License 1.1 ; devient Apache 2.0 à la date de changement écrite dans le fichier de licence (le 1er novembre 2030 le jour de la vérification) |
| Ce que la licence restreint | RSALv2 et SSPLv1 restreignent l'offre en service géré ; AGPLv3 est un copyleft qui s'étend au réseau | rien au-delà de l'attribution | l'usage au sein de votre propre produit est accordé ; l'offrir comme service de stockage de données en mémoire ne l'est pas |
| Origine | le projet d'origine | fork de Redis 7.2 sous la Linux Foundation (2024) | implémentation indépendante du protocole, multithread |
| Lua embarqué | 5.1 | 5.1 | 5.4 |
| Persistance | fichier en ajout seul (append-only) et instantanés | fichier en ajout seul et instantanés | instantanés |
| Compatibilité du protocole, telle que le kit l'a mesurée | référence | mêmes résultats que Redis sur la suite du kit | mêmes résultats sur la suite du kit ; deux différences de réponse absorbées par le bus d'événements ; refuse un script qui touche une clé non déclarée |

Les licences sont résumées, pas interprétées : faites lire les termes par la personne qui en est
responsable dans votre organisation, surtout si vous revendez de l'hébergement. Cette page n'a pas
mesuré les performances des serveurs et n'affirme rien à leur sujet.

## Critères de choix

1. **Adéquation de la licence.** Pour la plupart des services internes, les trois sont
   utilisables ; un hébergeur, ou une entreprise dont la politique écarte les logiciels à source
   disponible ou sous AGPL, réduit vite la liste.
2. **Ce que propose votre plateforme.** Un Redis ou un Valkey géré par votre cloud est une chose
   de moins à faire tourner.
3. **Besoins de persistance.** Un cache n'en a aucun. Un verrou et un limiteur de débit tolèrent
   un redémarrage. Redis Streams comme bus d'événements, c'est une autre affaire
   ([brokers de messages](message-brokers.fr.md)).
4. **Un serveur ou deux.** L'éviction convient à un cache et nuit aux verrous, aux clés de
   limitation de débit et aux streams.
5. **Avez-vous seulement besoin d'un serveur ?** Une seule instance n'a besoin de rien de tout
   cela : les ports en mémoire suffisent.

## Ce que ce kit prend en charge et a vérifié

D'après [`packages/redis/README.md`](../../packages/redis/README.fr.md) et
[`packages/kernel/README.md`](../../packages/kernel/README.fr.md) :

- **Testé contre** Dragonfly 2.0.2, Valkey 9.1.2 et Redis 8.10.2 avec ioredis 6, la même suite
  avec les mêmes résultats. ioredis 5 est accepté en *peer dependency* ; rien n'a été
  exécuté dessus. La suite a besoin d'un serveur et est sautée quand aucune URL n'est donnée.
- **Suites de contrat** (`cacheContract`, `lockContract`, `rateLimiterContract`) que
  l'implémentation en mémoire et l'adaptateur passent tous deux ; un adaptateur à vous y est tenu.
- **Choix de portabilité** : des scripts envoyés par `EVAL` avec chaque clé déclarée ; aucune
  arithmétique en Lua (les deux versions de Lua diffèrent sur les nombres) ; ni `KEYS`, ni
  modules, ni fonctions, ni notifications d'espace de clés.
- **Connexion** : un délai d'expiration (timeout) de deux secondes par commande et une nouvelle
  tentative (retry) par requête par défaut, si bien qu'un serveur absent échoue vite au lieu de
  bloquer chaque requête ; `redisHealth` pour une sonde de disponibilité (readiness).

- **Généré par la CLI** : `init --cache redis` écrit `src/platform/redis/open-redis.ts` (une
  connexion derrière `REDIS_URL`) et y relie les `Cache`, `RateLimiter` et `Lock` du noyau dans
  le module de la plateforme, avec le signal du relais pour l'outbox ; le fichier compose fait
  tourner Dragonfly 2.0.2 pour le développement local. Sans l'option, les trois restent dans la
  mémoire du processus. `init --queue redis` lie `RedisJobStore` pour les *jobs* en
  arrière-plan, et `init --broker redis` le bus d'événements sur Redis Streams.
- ***Jobs* en arrière-plan** : `RedisJobStore` est le `JobStore` de `@ddd-ts-kit/scheduling` sur
  les mêmes serveurs. Redis ne peut pas rejoindre la transaction de la base de données : un *job*
  ajouté dans une unité de travail est écrit une fois celle-ci validée, et un processus qui meurt
  entre les deux perd cette écriture sans que rien ne le signale. Une écriture que Redis refuse
  après la validation est passée à `onLostJob`, que `reportLostJobs(logger, errors)` journalise et
  signale. Avec une base de données, la table des *jobs* du *package* de l'ORM est le stockage le
  plus sûr
  ([*jobs* en arrière-plan](../concepts/background-jobs.fr.md)).

**Cache.** Des clés typées, un espace de noms par contexte ou par application, une durée de vie
en millisecondes. Un serveur en panne vaut un défaut de cache à la lecture et une écriture
abandonnée par défaut : l'application tourne comme si elle n'avait pas de cache, et
`cache_errors_total` est le signal à surveiller. `getOrLoad` protège contre une ruée (stampede) :
les appelants d'un même processus partagent un calcul, et avec un verrou un seul processus calcule
pendant que les autres attendent le verrou jusqu'à `waitMs`, puis renvoient la valeur qu'il a
écrite, ou la calculent eux-mêmes quand elle manque encore. Il n'échoue jamais à cause du verrou.
L'aspect `cached` refuse d'envelopper un *repository* ou un cas d'usage sauf autorisation
explicite : un agrégat servi depuis un cache masque qu'il est périmé, et la commande suivante
déciderait sur un état ancien.

![getOrLoad sur un défaut de cache : un calcul déjà en cours dans ce processus est partagé ; sinon, sans l'option lock de RedisCache, il exécute load et écrit la valeur avec sa durée de vie ; avec elle, il prend le verrou en attendant au plus waitMs, relit l'entrée et la renvoie si un autre processus l'a remplie entre-temps, ou exécute load, écrit la valeur et libère le verrou](../assets/diagrams/cache-and-coordination-get-or-load.fr.svg)

Quoi mettre en cache, et où. Au lieu de mettre en cache ce sur quoi une commande décide :

```ts
// AspectNotAllowedError dès que le repository est enveloppé
builder.bind(AppointmentRepository).toClass(KnexAppointmentRepository).as('repository')
  .with(cached({ key: (method, [id]) => `appointment:${String(id)}`, ttlMs: 60_000 }));
```

mettez en cache ce qui est lu ailleurs et peut être un peu ancien, depuis la racine de
composition, si bien que la *gateway* elle-même n'en sait rien :

<!-- checked sample -->
```ts
import { cached } from '@ddd-ts-kit/aspects';
import type { Cache } from '@ddd-ts-kit/kernel';

interface WorkingHours {
  readonly practitionerId: string;
  readonly opensAt: string;
  readonly closesAt: string;
}

// contexts/availability/application/ports/calendar.gateway.ts
export abstract class CalendarGateway {
  abstract workingHoursOf(practitionerId: string): Promise<WorkingHours>;
}

declare const httpCalendars: CalendarGateway; // l'adaptateur qui appelle le contexte calendars
declare const cache: Cache; // RedisCache avec plusieurs instances, InMemoryCache avec une seule

// src/platform/ : cinq minutes de retard sont acceptables pour des horaires de travail.
export const calendars = cached({
  key: (method, [practitionerId]) => (method === 'workingHoursOf' ? `working-hours:${String(practitionerId)}` : undefined),
  ttlMs: 5 * 60_000,
  cache,
})(httpCalendars, { kind: 'gateway', context: 'availability' });
```

Des appels identiques et simultanés partagent un seul appel au contexte calendars ; un appel en
échec n'est pas mis en cache ; un cache en panne vaut un défaut de cache. Avec un conteneur, le
même aspect se pose sur la liaison : `.as('gateway').with(cached({ ... }))`.

**Limiteur de débit.** Une fenêtre glissante exacte : un membre d'ensemble trié par appel
autorisé, décidé dans un seul script, si bien que des instances concurrentes ne peuvent pas
prendre toutes deux la dernière place. Un appel refusé n'est pas compté. `onError` choisit entre
`throw` (le défaut), `allow` (habituel devant une API) et `deny` (pour les limites qui sont un
contrôle de sécurité).

Une limite qui est une règle métier (« trois tentatives de réservation par minute et par
client ») appartient au cas d'usage, qui dépend du port et refuse avec un code qui lui est
propre :

<!-- checked sample -->
```ts
import { DomainRefusal, RateLimiter } from '@ddd-ts-kit/kernel';

// contexts/appointments/domain/errors/codes.ts
export const AppointmentsCodes = { TooManyBookingAttempts: 'TOO_MANY_BOOKING_ATTEMPTS' } as const;

// contexts/appointments/domain/errors/too-many-booking-attempts.error.ts
export class TooManyBookingAttempts extends DomainRefusal {
  readonly code = AppointmentsCodes.TooManyBookingAttempts;

  static withRetryAfter(retryAfterMs: number) {
    return TooManyBookingAttempts.refusal('Too many booking attempts, try again later.', { retryAfterMs });
  }
}

// contexts/appointments/application/ : appelé par le gestionnaire de BookAppointment avant toute autre chose.
export class BookingAttempts {
  constructor(private readonly limiter: RateLimiter) {}

  async admit(clientId: string): Promise<void> {
    const decision = await this.limiter.consume(`booking:${clientId}`, { limit: 3, windowMs: 60_000 });

    if (!decision.allowed) {
      throw TooManyBookingAttempts.withRetryAfter(decision.retryAfterMs);
    }
  }
}
```

Dans une *spec*, `InMemoryRateLimiter` sur une `FixedClock` est son *fake* : avancez l'horloge
d'une minute et la quatrième tentative est admise.

**Verrou.** L'algorithme à instance unique de la documentation de Redis : `SET NX PX` avec un
propriétaire aléatoire, la libération par comparaison puis suppression, un jeton de clôture
(fencing token) incrémenté dans le même script.

**Signal du relais.** La publication et l'abonnement (publish/subscribe) servent d'indice pour
réveiller le relais de l'outbox ; une notification perdue ne fait que retarder la publication
jusqu'à la scrutation suivante.

## Ce que le verrou garantit, et ce qu'il ne garantit pas

Il garantit au plus un détenteur à la fois **à condition** que le serveur garde ses données et que
le détenteur termine dans les `ttlMs`. Ce n'est pas un verrou à consensus. Le README liste les cas
où deux détenteurs existent en même temps :

- le détenteur est mis en pause (ramasse-miettes, disque bloqué, conteneur suspendu) plus
  longtemps que la durée de vie et reprend son travail ;
- le serveur bascule sur un réplica qui n'avait pas reçu la clé ;
- le serveur redémarre sans persistance, ou évince la clé sous la pression mémoire ;
- les horloges côté serveur font un saut.

![L'instance A prend le verrou avec une durée de vie de 60 secondes et reçoit le jeton 41, puis elle est en pause 90 secondes ; la clé expire ; l'instance B le prend, reçoit le jeton 42 et écrit avec lui ; A reprend et écrit avec le jeton 41, ce que refuse un stockage qui retient le plus grand jeton](../assets/diagrams/cache-and-coordination-two-holders.fr.svg)

Le **jeton de clôture** réduit ce risque pour les ressources capables de comparer : un stockage
qui retient le plus grand jeton qu'il a vu refuse l'écriture portant 41 après avoir vu 42. Ce
n'est pas une preuve non plus : le compteur vit dans le même serveur et repart de zéro si ce
serveur perd ses données. Le verrou n'est par ailleurs **ni réentrant ni renouvelé** : choisissez
un `ttlMs` au-dessus du pire cas du travail, ou découpez le travail. Un serveur absent fait
rejeter `acquire`, puisque personne ne peut savoir si la clé est prise.

Un stockage compare les jetons par une condition sur son écriture. Ici, la ligne d'un export
garde le jeton du détenteur qui l'a écrite en dernier, et un détenteur dont le verrou a expiré ne
change rien :

<!-- checked sample -->
```ts
import type { LockHandle } from '@ddd-ts-kit/kernel';

interface Database {
  execute(sql: string, values: readonly unknown[]): Promise<{ readonly rowCount: number }>;
}

/** Renvoie false quand un détenteur plus récent du verrou a déjà écrit : celui-ci a été mis en pause au-delà de son ttlMs. */
export async function writeExport(database: Database, holder: LockHandle, content: string): Promise<boolean> {
  const { rowCount } = await database.execute(
    'update exports set content = $1, fencing_token = $2 where id = $3 and fencing_token <= $2',
    [content, holder.fencingToken, 'nightly'],
  );

  return rowCount === 1;
}
```

D'où la règle que le noyau énonce pour `Lock` lui-même : un outil d'efficacité, jamais la garde
d'un invariant. Au lieu de garder avec lui l'invariant « pas de double réservation » :

```ts
// une pause de plus de cinq secondes, une bascule, une éviction : et deux réservations d'un même créneau passent
const handle = await lock.acquire(`slot:${calendarId}:${startsAt}`, { ttlMs: 5_000 });
if (handle === undefined) {
  throw SlotTaken.forCalendar(calendarId, startsAt);
}
await appointments.save(Appointment.book(calendarId, startsAt));
```

laissez l'invariant à l'agrégat et à une contrainte de la base de données (la contrainte
d'exclusion de la [page sur la persistance](persistence.fr.md)), et gardez le verrou pour un
travail dont la double exécution ne coûte que du travail, comme l'envoi des rappels de ce matin
par une commande qui saute ce qui a déjà été envoyé :

<!-- checked sample -->
```ts
import type { Lock } from '@ddd-ts-kit/kernel';

declare function sendTodaysReminders(): Promise<void>; // idempotent : un rappel déjà envoyé est sauté

export async function sendRemindersOnce(lock: Lock, day: string): Promise<void> {
  const handle = await lock.acquire(`notifications.send-reminders:${day}`, { ttlMs: 15 * 60_000 });

  if (handle === undefined) {
    return; // une autre instance les envoie, ou les a envoyés
  }

  // Pas libéré à la fin : une instance dont le minuteur se déclenche un peu plus tard trouve la clé
  // encore prise et n'envoie rien. Le verrou se libère de lui-même après ttlMs.
  await sendTodaysReminders();
}
```

Un *job* planifié déclaré `singleInstance` obtient cela du planificateur de
`@ddd-ts-kit/scheduling`, qui prend le verrou sous `job:<name>:<scheduled instant>` avant chaque
occurrence ; les autres enregistrent `skipped-locked`
([*jobs* planifiés](../concepts/scheduled-jobs.fr.md)).

| Besoin | Le bon outil | Pourquoi |
|---|---|---|
| une seule instance envoie les rappels de ce matin | `Lock`, et une commande idempotente | une rare double exécution gaspille du travail ; la commande envoie de toute façon chaque rappel une fois |
| recalculer une seule fois une entrée de cache coûteuse | `Lock` par `getOrLoad` | le pire cas est le calcul sans protection |
| un praticien n'est jamais réservé deux fois | une contrainte d'exclusion ou d'unicité dans le schéma `appointments`, plus l'agrégat | tient quoi que croie n'importe quel processus au sujet d'un verrou |
| un rendez-vous n'est pas reprogrammé par deux requêtes HTTP à la fois | la concurrence optimiste sur la `version` de l'agrégat | le second écrivain reçoit un conflit |
| un événement d'intégration est traité une fois par consommateur | le registre des événements traités dans la transaction du consommateur | une marque dans Redis et une modification dans PostgreSQL sont deux systèmes |
| une occurrence de *job* s'exécute exactement une fois et survit à un plantage | pas disponible : une ligne dans une table traitée par un *job* répétable | [*jobs* planifiés](../concepts/scheduled-jobs.fr.md) |

## Limites, et quand ne pas l'utiliser

Énoncées par le *package* :

- **Un serveur, ou un primaire avec des réplicas.** Un Redis Cluster fonctionne pour le cache et
  le verrou ; `deleteByPrefix` ne parcourt pas chaque nœud. Pas testé sur un cluster.
- **L'éviction s'applique à tout.** Sous `allkeys-lru`, un verrou ou une clé de limitation de
  débit peut être évincé comme une entrée de cache. Utilisez une politique `volatile-*`, ou un
  second serveur pour ce qui n'est pas un cache.
- **Pas de cache côté client, pas de pipelining des lectures** : chaque `get` est un aller-retour.
- **Les valeurs sont en JSON par défaut** : `Date`, `Map`, `bigint` et les instances de classe ne
  survivent pas. Mettez en cache des données simples.
- **`deleteByPrefix` n'est pas atomique** et c'est un outil d'administration ; préférez des durées
  de vie courtes à l'invalidation.
- **La mémoire du limiteur de débit** croît avec la limite (un membre par appel autorisé) : cela
  va jusqu'à des milliers par fenêtre. **Son horloge est celle de l'appelant** : les instances
  doivent être synchronisées, et un décalage déplace la fenêtre d'autant.
- **Pas de registre des événements traités sur Redis**, délibérément, et pas d'outbox : ce qui
  doit être atomique avec les données métier vit dans la base de données.

Quand ne pas utiliser de cache : devant un *repository* d'agrégats ; pour masquer une requête
lente qu'un index ou un modèle de lecture corrigerait ; quand la donnée doit être exacte à
l'instant d'une décision. Quand ne pas utiliser le verrou : chaque fois que la phrase qui décrit
le besoin contient « jamais ».

## Recommandation selon la situation

| Situation | Choix |
|---|---|
| Une seule instance | aucun serveur : les ports en mémoire de `kernelModule()` |
| Plusieurs instances, un cache et des *jobs*, aucune contrainte de licence | n'importe lequel des trois ; le fichier compose généré fait tourner Dragonfly pour le développement local |
| Une politique qui exige une licence open source permissive | Valkey |
| Un service géré de votre fournisseur cloud | ce qu'il propose qui parle le protocole ; faites tourner les suites de contrat contre lui une fois |
| Un cache plus Redis Streams comme bus d'événements | deux serveurs ou deux politiques : le bus a besoin de `noeviction` et de persistance |
| Une exigence stricte d'exclusion mutuelle | pas ce *package* : une contrainte de base de données, ou un système à consensus que vous exploitez en connaissance de cause |

## Sources

- Documentation de Redis, verrous distribués (le patron à instance unique et ses limites) :
  https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/
- Martin Kleppmann, « How to do distributed locking » (2016), sur les pauses et les jetons de
  clôture : https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
- Licence de Redis : https://github.com/redis/redis/blob/unstable/LICENSE.txt ; Valkey :
  https://github.com/valkey-io/valkey ; licence de Dragonfly :
  https://github.com/dragonflydb/dragonfly/blob/main/LICENSE.md (tous lus le 2026-10-10)
- Politiques d'éviction de Redis : https://redis.io/docs/latest/develop/reference/eviction/
- Michael Nygard, Release It!, 2e édition, Pragmatic Bookshelf, 2018 (le cache comme risque pour
  la stabilité).
- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapitre 8.
- Non vérifié : les modes de persistance de Dragonfly au-delà de ce qu'en dit le README du kit
  (instantanés) ; le comportement de chacun des trois en mode cluster.

## Voir aussi

- [Résilience](../concepts/resilience.fr.md)
- [*Jobs* planifiés](../concepts/scheduled-jobs.fr.md)
- [Agrégats](../concepts/aggregates.fr.md)
- [Livraison et idempotence](../concepts/delivery-and-idempotency.fr.md)
- [Brokers de messages](message-brokers.fr.md)
- [Persistance](persistence.fr.md)
- [Caches HTTP](http-caches.fr.md) : le cache partagé devant l'API, Varnish et les CDN
