[English](http-caches.md) · **Français**
<!-- translation-of: http-caches.md sha256:cb8ef99ce0261bfe -->

# Caches HTTP : Varnish, Souin, nginx, Fastly, Cloudflare, Bunny

**Résumé.** Un cache HTTP partagé placé devant l'API répond aux lectures identiques pour tout le
monde sans atteindre l'application. Le kit envoie ce dont le cache a besoin (le `Cache-Control`
de la politique de chaque route, l'`ETag`, et les étiquettes des ressources qu'une réponse montre)
et purge par étiquette après la validation (commit) de la commande qui les a changées, par le port
`CachePurger`. Ce qui sépare les candidats, c'est leur façon de purger : par étiquette tout de
suite, par étiquette au moyen d'un *ban*, par URL seulement, ou pas du tout sans offre payante, et
le fait qu'ils respectent ou non `Vary`. Varnish avec vmod_xkey est celui que le kit génère et
exécute en CI ; Fastly et Cloudflare ont des adaptateurs tenus à la suite de contrat sur un *fake*
de l'API de purge que chacun documente, jamais sur les services ; Bunny, Souin et nginx sont
décrits, pas implémentés.

## Ce que le kit demande à un cache partagé

1. **Respecter la politique de la route** : garder ce que `Cache-Control: public, s-maxage=...`
   permet, laisser passer ce qui est `private` ou `no-store`, et ne jamais répondre depuis le cache
   à une requête HTTP qui porte `Authorization` ou un cookie, sauf si la route varie selon lui.
2. **Ranger une réponse sous ses étiquettes**, lues dans un en-tête de la réponse (`xkey`,
   `Surrogate-Key`, `Cache-Tag`, `CDN-Tag`), et retirer cet en-tête avant le client.
3. **Purger par étiquette**, par une API que l'application appelle, confirmée par un 2xx : le
   relais de l'outbox réessaie jusqu'à l'obtenir.
4. **Revalider** une réponse périmée avec `If-None-Match` et la garder sur un `304`.

Le cycle complet, pour les horaires d'ouverture d'un calendrier dans l'application d'exemple : la
première lecture atteint l'API et est rangée sous son étiquette, les suivantes reçoivent leur
réponse du cache, et la commande qui change les horaires purge l'étiquette une fois validée.

![Une séquence entre le client, le cache partagé, l'API, la base de données et le relais de l'outbox : une lecture publique absente du cache est transmise à l'API, répondue avec l'en-tête d'étiquettes xkey: calendar:c-1 et gardée une heure sous cette étiquette ; la même lecture est ensuite servie par le cache ; une commande enregistre le calendrier et une demande de purge dans une seule transaction, et le relais envoie PURGE avec xkey-purge: calendar:c-1, ce qui retire la réponse](../assets/diagrams/http-caches-read-and-purge.fr.svg)

Ce qui circule sur le réseau pour `GET /calendars/c-1/opening-hours` de l'exemple, derrière le
Varnish que génère la CLI. Son contrôleur déclare la politique de l'exemple de code plus bas, et en
plus `etag: { version: 'version' }`, qui fait du champ `version` du corps l'`ETag` :

```http
# 1. L'API répond à un miss de Varnish : la politique de la route, la version, les étiquettes
HTTP/1.1 200 OK
Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400
ETag: W/"7"
xkey: calendar:c-1

# 2. Varnish répond au client : l'en-tête d'étiquettes retiré, x-cache ajouté par la VCL générée
HTTP/1.1 200 OK
Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400
ETag: W/"7"
x-cache: MISS

# 3. Une fois le changement des horaires validé, le relais purge par VarnishCachePurger
PURGE / HTTP/1.1
x-purge-key: <la clé avec laquelle Varnish a été démarré>
xkey-purge: calendar:c-1

HTTP/1.1 200 Purged 1
```

L'en-tête d'étiquettes change avec le cache (`Surrogate-Key` pour Fastly, `Cache-Tag` pour
Cloudflare, `CDN-Tag` pour Bunny), et la requête de purge aussi ; la route et le cas d'usage
restent les mêmes.

## Comparaison

| | Varnish (xkey) | Souin | nginx (open source) | Fastly | Cloudflare | Bunny |
|---|---|---|---|---|---|---|
| Nature | proxy auto-hébergé | proxy auto-hébergé, ou *middleware* de Caddy, Traefik et d'autres | proxy auto-hébergé | CDN | CDN | CDN |
| Licence ou prix | open source (BSD 2-clause) ; voir « Varnish et Vinyl » ci-dessous | MIT | BSD 2-clause ; la purge est dans NGINX Plus, payant | payant, crédit d'essai gratuit | offre gratuite comprise | payé au trafic, pas d'offre gratuite |
| En-tête d'étiquettes | `xkey` (aussi `X-HashTwo`) | `Surrogate-Key` | aucun | `Surrogate-Key` | `Cache-Tag` | `CDN-Tag` |
| Purge par étiquette | `xkey.purge`, immédiate ; ou un *ban* sur l'en-tête gardé, paresseux | `PURGE` avec `Surrogate-Key` sur son API | non : le module tiers `ngx_cache_purge` purge une clé (URL) à la fois | `POST /service/<id>/purge`, 256 clés par requête | `POST /zones/<id>/purge_cache`, 100 étiquettes par requête, toutes offres | `POST /pullzone/<id>/purgeCache` avec un seul `CacheTag` |
| Purge douce (servir le périmé pendant le rechargement) | `xkey.softpurge` | non vérifié | non | `Fastly-Soft-Purge: 1` | non | non vérifié |
| Respecte `Vary` | oui, une copie par valeur | oui (documenté, non exécuté) | oui, depuis 1.7.7 (non exécuté) | oui | non, images mises à part : une réponse qui varie est refusée au montage (`cacheTags.honoursVary` pour passer outre) | non, un ensemble fixe qui lui est propre (chaîne de requête, cookie, pays) : refusée de même |
| Adaptateur dans le kit | `VarnishCachePurger` | aucun (son API de purge est proche de celle de Varnish ; non écrit) | aucun | `FastlyCachePurger` | `CloudflareCachePurger` | aucun |
| Vérifié par le kit | la suite de contrat sur Varnish 9.1.0 avec la VCL générée, en CI | non exécuté | non exécuté | la suite de contrat sur un *fake* de son API de purge documentée, et les requêtes contrôlées | la suite de contrat sur un *fake* de son API de purge documentée, et les requêtes contrôlées | non exécuté |

Chiffres et formes d'API lus le 2026-10-13 dans la documentation de chaque éditeur (Sources).

## Varnish et Vinyl

Depuis mars 2026, le projet open source autrefois appelé Varnish Cache s'appelle **Vinyl Cache**
(la 9.0 a été sa première version publiée sous ce nom, `vinyld` au lieu de `varnishd`), et Varnish
Software poursuit en *fork* des versions nommées Varnish Cache. L'image Docker officielle
`varnish`, que le kit épingle (`varnish:9.1.0`), est maintenue par la communauté Docker de Varnish
Software et livre vmod_xkey parmi ses modules. La VCL qu'écrit le kit utilise `vcl 4.1` et
`import xkey` ; le kit ne l'a pas exécutée sur Vinyl Cache, dont les paquets de vmod_xkey n'ont
pas été vérifiés.

## Ce que ce kit prend en charge et a vérifié

- **Généré par la CLI** : `init --http-cache varnish` ajoute un service Varnish au fichier
  compose, sa VCL sous `docker/varnish/default.vcl`, et branche `VarnishCachePurger` dans le
  relais de l'outbox de `main.ts` et de chaque service qu'écrit `generate service`, ainsi qu'un
  purgeur qui enregistre dans le relais de l'application de bout en bout (`purges.purged`), avec
  `cacheTags: { header: CacheTagHeader.xkey }`. La VCL ne garde qu'une réponse qui le permet
  nommément (`max-age` ou `s-maxage` dans `Cache-Control`) : une route sans politique, un document
  *problem*, une sonde ne sont jamais gardés, quel que soit le TTL par défaut de Varnish. Elle
  laisse entrer une purge depuis sa propre machine, ou de n'importe où avec la clé avec laquelle
  elle a été démarrée (`VARNISH_PURGE_KEY`, envoyée par le purgeur dans `x-purge-key`) : l'API
  atteint un conteneur par son port publié, depuis une autre adresse. Un *ban* que Varnish refuse
  reçoit un `500`, et le purgeur échappe les caractères de motif d'une étiquette.
- **Suite de contrat** : `cachePurgerContract` de `@ddd-ts-kit/testing/contracts`, passée par
  `InMemoryCachePurger`, `RepeatedCachePurger`, par `VarnishCachePurger` dans ses deux modes
  (xkey, *ban*) sur Varnish 9.1.0, démarré par `pipeline/github/scripts/start-varnish.sh` dans le
  *job* d'intégration, et par `FastlyCachePurger` et `CloudflareCachePurger` sur un *fake* de leur
  API de purge (chemin, identifiant d'accès, borne d'une requête, étiquettes comparées telles
  qu'écrites pour Fastly et sans casse pour Cloudflare, comme chacun le documente). Elle tient :
  seules les réponses qu'une étiquette nomme, chaque étiquette d'une requête, une étiquette
  contenant des caractères de motif prise telle qu'écrite, un autre *tenant* intact, l'idempotence.
- **Adaptateurs de CDN** : `FastlyCachePurger` et `CloudflareCachePurger` envoient les requêtes
  que leur documentation décrit, par lots de la borne qu'elle fixe, et échouent avec
  `CachePurgeError` sur tout ce qui n'est pas un 2xx. Aucun compte n'a été utilisé : le *fake* suit
  la documentation, les services n'ont pas été exécutés.
- **De bout en bout** : l'application d'exemple tourne derrière Varnish en CI et prouve que la
  lecture d'un calendrier est servie par le cache, puis rechargée après la commande qui le change.

Le cœur du `docker/varnish/default.vcl` généré, raccourci : qui peut purger, les deux façons de
purger, et la règle qui ne garde que ce qu'une réponse permet nommément.

```vcl
sub vcl_recv {
    if (req.method == "PURGE") {
        # depuis cette machine, ou de n'importe où avec la clé avec laquelle Varnish a été démarré
        if (client.ip !~ purgers && !(std.getenv("VARNISH_PURGE_KEY") != "" && req.http.x-purge-key == std.getenv("VARNISH_PURGE_KEY"))) {
            return (synth(403, "Forbidden"));
        }

        if (req.http.xkey-purge) {
            # chaque objet rangé sous l'une des étiquettes, retiré tout de suite
            set req.http.x-purged = xkey.purge(req.http.xkey-purge);
        } elsif (req.http.x-ban-tag) {
            # un ban sur l'en-tête xkey que gardent les objets, testé quand ils sont cherchés
            if (!std.ban("obj.http.xkey ~ (^|\s)" + req.http.x-ban-tag + "(\s|$)")) {
                return (synth(500, "Ban refused: " + std.ban_error()));
            }

            set req.http.x-purged = "a ban";
        }

        return (synth(200, "Purged " + req.http.x-purged));
    }
}

sub vcl_backend_response {
    # ni max-age ni s-maxage : jamais gardée, quel que soit le TTL par défaut de Varnish
    if (beresp.http.cache-control !~ "(^|,)\s*(s-maxage|max-age)=") {
        set beresp.uncacheable = true;
        set beresp.ttl = 120s;

        return (deliver);
    }
}
```

## Comment une purge atteint le cache

Un gestionnaire (handler) d'un événement du domaine du cas d'usage demande à `CacheInvalidation`
de purger des étiquettes ; la demande devient une ligne de l'outbox dans la transaction de la
commande ; après la validation, le relais la remet à `PurgingPublisher`, qui envoie les demandes
de purge au port `CachePurger` et tout autre événement au *broker*. De toutes ces pièces, seul
l'adaptateur derrière le port `CachePurger` sait quel cache est devant.

![Les pièces d'une purge : un gestionnaire d'événement demande à CacheInvalidation, PublishedCacheInvalidation publie une demande de purge que le store de l'outbox écrit dans la transaction de la commande ; l'OutboxRelay la remet à PurgingPublisher, qui envoie les demandes de purge au port CachePurger et tout autre événement au broker ; VarnishCachePurger, FastlyCachePurger, CloudflareCachePurger ou un purgeur à vous implémentent le port, et RepeatedCachePurger enveloppe l'un d'eux](../assets/diagrams/http-caches-purger-wiring.fr.svg)

La lecture nomme ses étiquettes, et le cas d'usage qui change la ressource demande leur purge,
avec la même fonction (`cacheTag`), si bien que les deux se rejoignent toujours :

<!-- checked sample -->
```ts
import { CacheScope, Public, RouteGroup } from '@ddd-ts-kit/http';
import { cacheTag, type CacheInvalidation, type DomainEvent } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

// présentation : chaque lecture du groupe est gardée une heure par un cache partagé, rangée sous calendar:<calendarId>,
// et servie périmée pendant un jour si l'API échoue
@RouteGroup({
  prefix: '/calendars/:calendarId',
  guards: [Public],
  cache: {
    scope: CacheScope.public,
    maxAge: '1m',
    sMaxAge: '1h',
    staleWhileRevalidate: '30s',
    staleIfError: '1d',
    tags: [{ resource: 'calendar', param: 'calendarId' }],
  },
})
export class CalendarPagesRoutes {}

// domaine : ce que l'agrégat enregistre quand ses horaires d'ouverture changent
export class CalendarOpeningHoursSet implements DomainEvent {
  static readonly eventName = 'scheduling.calendar.opening-hours-set';

  readonly name = CalendarOpeningHoursSet.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}

// application : demandée avant la validation (la phase par défaut), purgée après, par l'outbox
@DomainEventHandler(CalendarOpeningHoursSet)
export class CalendarOpeningHoursSetEventHandler implements DomainEventHandler<CalendarOpeningHoursSet> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarOpeningHoursSet): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}
```

La plateforme choisit le cache à deux endroits qui doivent s'accorder : l'en-tête d'étiquettes
qu'envoient les routes (`cacheTags.header` des options du montage) et le purgeur qu'appelle le
relais. Le `main.ts` d'un projet généré avec `--http-cache varnish` fait la moitié Varnish de ce
travail ; l'application d'exemple ajoute la seconde purge :

<!-- checked sample -->
```ts
import { OutboxRelay, type OutboxStore } from '@ddd-ts-kit/events';
import { CacheTagHeader } from '@ddd-ts-kit/http';
import { CloudflareCachePurger, FastlyCachePurger, VarnishCachePurger } from '@ddd-ts-kit/http/purgers';
import {
  PurgingPublisher,
  RepeatedCachePurger,
  type CachePurger,
  type Clock,
  type IntegrationEventPublisher,
} from '@ddd-ts-kit/kernel';

type CacheInFront = 'varnish' | 'fastly' | 'cloudflare';

// lue dans l'environnement par la configuration de la plateforme
declare const config: {
  readonly cache: CacheInFront;
  readonly varnishUrl: string;
  readonly varnishPurgeKey: string;
  readonly fastlyServiceId: string;
  readonly fastlyToken: string;
  readonly cloudflareZoneId: string;
  readonly cloudflareToken: string;
};
declare const store: OutboxStore;
declare const broker: IntegrationEventPublisher;
declare const clock: Clock;

// l'en-tête qu'envoient les routes, donné au montage sous la forme cacheTags: { header: tagHeaders[config.cache] }
export const tagHeaders = {
  varnish: CacheTagHeader.xkey,
  fastly: CacheTagHeader.surrogateKey,
  cloudflare: CacheTagHeader.cacheTag,
} as const satisfies Record<CacheInFront, CacheTagHeader>;

// le purgeur du même cache : seul celui qui est devant l'API est construit
const purgers: Record<CacheInFront, () => CachePurger> = {
  varnish: () => new VarnishCachePurger({ url: config.varnishUrl, key: config.varnishPurgeKey }),
  fastly: () => new FastlyCachePurger({ serviceId: config.fastlyServiceId, token: config.fastlyToken }),
  cloudflare: () => new CloudflareCachePurger({ zoneId: config.cloudflareZoneId, token: config.cloudflareToken }),
};

// les demandes de purge au cache, purgées une fois de plus 2 s après ; tout autre événement au broker
const relay = new OutboxRelay({
  store,
  publisher: new PurgingPublisher(new RepeatedCachePurger(purgers[config.cache](), { againAfterMs: 2_000 }), broker),
  clock,
});

relay.start({ intervalMs: 1_000 });
```

## Un purgeur à vous

Souin, Bunny ou tout cache doté d'une API de purge demande une classe de quelques lignes qui
implémente `CachePurger` : elle envoie les étiquettes, se résout sur un 2xx, et lève
`CachePurgeError` sur tout le reste pour que le relais réessaie. Ensuite, la suite de contrat la
prouve contre le vrai cache, comme le kit prouve Varnish. L'exemple suit l'API de purge que Souin
documente (un `PURGE` qui nomme les clés dans `Surrogate-Key`) ; le kit ne l'a pas exécuté.

<!-- checked sample -->
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { CachePurgeError } from '@ddd-ts-kit/http/purgers';
import type { CachePurger } from '@ddd-ts-kit/kernel';
import { cachePurgerContract } from '@ddd-ts-kit/testing/contracts';

// platform/http-cache/souin-cache-purger.ts
export interface SouinCachePurgerOptions {
  /** L'API de purge de Souin telle que l'application l'atteint, telle que ses réglages `api` l'exposent. */
  readonly url: string;
  /** 5000 par défaut. */
  readonly timeoutMs?: number;
}

export class SouinCachePurger implements CachePurger {
  constructor(private readonly options: SouinCachePurgerOptions) {}

  async purge(tags: readonly string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    const { url, timeoutMs = 5_000 } = this.options;
    const answer = await fetch(url, {
      method: 'PURGE',
      headers: { 'surrogate-key': tags.join(', ') },
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((cause: unknown) => {
      throw new CachePurgeError(`PURGE ${url} reached no cache.`, undefined, { cause });
    });

    await answer.body?.cancel();

    // tout ce qui n'est pas un 2xx lève : le relais réessaie la demande de purge
    if (!answer.ok) {
      throw new CachePurgeError(`PURGE ${url} answered ${answer.status}.`, answer.status);
    }
  }
}

// test/integration/souin-cache-purger.contract.spec.ts : Souin devant une origine que la spec démarre
declare const souin: { readonly url: string; readonly purgeUrl: string };
declare const origin: { answerUnder(path: string, tags: readonly string[]): void };
declare function servedFromCache(answer: Response): boolean; // lit l'en-tête Cache-Status de Souin

let run = 0;

cachePurgerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'SouinCachePurger',
    createCache: () => {
      run += 1;
      const namespace = `/${Date.now()}-${run}`;

      return {
        purger: new SouinCachePurger({ url: souin.purgeUrl }),
        store: async (key, tags) => {
          origin.answerUnder(`${namespace}${key}`, tags);
          await fetch(`${souin.url}${namespace}${key}`).then((answer) => answer.text());
        },
        holds: async (key) => servedFromCache(await fetch(`${souin.url}${namespace}${key}`)),
      };
    },
  },
);
```

La suite tient ce sur quoi le relais compte : seules les réponses qu'une étiquette nomme sont
purgées, chaque étiquette d'une requête, une étiquette contenant des caractères de motif prise
telle qu'écrite, les réponses d'un autre *tenant* intactes, et une seconde purge des mêmes
étiquettes ne change rien.

## Limites, et quand ne pas l'utiliser

- **La purge n'est pas instantanée** : elle a lieu quand le relais remet la demande, après la
  validation (l'intervalle du relais, ou tout de suite quand le relais est réveillé). Entre la
  validation et la purge, le cache sert la réponse précédente. Une lecture qui doit montrer
  l'écriture qu'elle suit (lire ses propres écritures) ne reçoit pas sa réponse d'un cache partagé.
- **Une demande de purge n'est perdue avec sa ligne d'outbox** que si la ligne est purgée ou
  morte : le relais réessaie un cache en échec jusqu'à `maxAttempts`, puis l'enregistrement est
  mort et la réponse reste jusqu'au `s-maxage`. Gardez `s-maxage` au niveau de péremption que vous
  acceptez quand le cache est injoignable.
- **Taille des en-têtes** : une réponse qui liste des centaines de ressources porte des centaines
  d'étiquettes. Varnish borne un en-tête de réponse à 8 Ko par défaut (`http_resp_hdr_len`),
  Cloudflare à 16 Ko de `Cache-Tag`. Étiquetez une longue liste par sa sorte
  (`{ resource: 'appointment' }`) plutôt que chaque élément.
- **Les *bans* s'accumulent** : en `mode: 'ban'`, chaque purge ajoute un *ban* que Varnish teste
  sur les objets qu'il cherche jusqu'à ce qu'ils soient tous plus récents ; préférez xkey, gardez
  les *bans* pour un Varnish qui ne l'a pas.
- **Les réponses authentifiées passent** : la VCL générée garde la règle intégrée qui laisse
  passer toute requête HTTP portant `Authorization` ou un cookie. Une route déclarée `public` avec
  `vary: ['Authorization']` n'est mise en cache qu'une fois que la VCL inclut cet en-tête dans son
  hachage : écrivez-le délibérément.
- **Une lecture en route quand la purge s'exécute** est gardée comme fraîche pendant tout son
  `s-maxage` : purgez deux fois (`RepeatedCachePurger`), ou gardez un `s-maxage` court là où la
  réponse doit converger (voir
  [Cache HTTP](../concepts/http-caching.fr.md#une-lecture-en-route-quand-la-purge-sexécute)).
- **La clé de purge est un secret en production** : celle, locale, de `.env.example` ne sert
  qu'au développement. Gardez aussi la méthode `PURGE` hors du côté public d'un répartiteur de
  charge : derrière lui, chaque client atteint Varnish depuis l'adresse du répartiteur.
- **Limites de débit des CDN** : Cloudflare autorise 5 requêtes de purge par minute dans son offre
  gratuite, partagées par toutes les zones du compte. Une rafale de commandes atteint cette
  limite ; le relais réessaie.
- ***Tenants*** : une application multitenant range les étiquettes sous le *tenant*
  (`acme/calendar:c-1`), sur les réponses et sur les purges, les deux ou aucun. Une route publique
  étiquetée que n'importe qui peut appeler a besoin de `resolveTenant` (refusée au montage sans
  lui) ; une requête HTTP qui ne nomme aucun *tenant* reçoit `no-store`. Un *tenant* lu dans un
  en-tête fait varier chaque réponse gardée selon lui, ce que Cloudflare et Bunny ignorent :
  lisez-le dans l'hôte ou le chemin derrière eux.

## Recommandation selon la situation

![Un arbre de décision : si aucune réponse publique n'est lue par beaucoup d'appelants bien plus souvent qu'elle ne change, pas de cache partagé, seulement des politiques private et des ETag ; si un CDN est déjà devant, son adaptateur (Fastly, Cloudflare, ou le vôtre pour Bunny) ; sinon, selon le proxy devant l'API : aucun, Varnish avec la VCL générée ; Caddy ou Traefik, Souin avec un purgeur à vous ; nginx, pas de purge par étiquette sans NGINX Plus, donc un s-maxage court ou Varnish derrière lui](../assets/diagrams/http-caches-choosing.fr.svg)

| Situation | Choix |
|---|---|
| Une instance, peu de lecteurs | pas de cache partagé : les politiques `private` et les `ETag` réduisent les transferts |
| Auto-hébergé, lectures publiques bien plus lues qu'écrites | Varnish avec la VCL générée |
| Déjà derrière Caddy ou Traefik | Souin comme leur *middleware* ; écrivez un `CachePurger` sur son API de purge et lancez la suite de contrat contre lui |
| Déjà sur nginx | pas de purge par étiquette sans NGINX Plus : un `s-maxage` court seulement, ou Varnish derrière lui |
| Audience mondiale, un CDN en place | son adaptateur (Fastly, Cloudflare), ou un adaptateur de quelques lignes sur son API de purge, tenu à la suite de contrat |

## Sources

- Image Varnish et ses vmods : https://hub.docker.com/_/varnish (lu le 2026-10-13 ;
  `varnish:9.1.0` liste `libvmod_xkey.so`).
- vmod_xkey : https://github.com/varnish/varnish-modules/blob/master/src/vmod_xkey.vcc
- Annonce de Vinyl Cache 9.0 : https://vinyl-cache.org/lists/pipermail/vinyl-announce/2026-March/000144.html
- API de purge de Fastly : https://www.fastly.com/documentation/reference/api/purging/
- Purge par étiquette et limites de Cloudflare : https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/
  et https://developers.cloudflare.com/cache/how-to/purge-cache/
- API de purge de Bunny : https://docs.bunny.net/reference/pullzonepublic_purgecachepostbytag (pas
  lue en détail ; non implémentée).
- Souin : https://github.com/darkweak/souin (non exécuté).
- `proxy_cache` de nginx : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache
- RFC 9111 (cache HTTP), RFC 9110 sections 8.8 et 13 (validateurs et requêtes conditionnelles).

## Voir aussi

- [Cache HTTP](../concepts/http-caching.fr.md) : quoi mettre en cache, à quelle couche
- [Cache et coordination](cache-and-coordination.fr.md) : le cache applicatif sur Redis, Valkey ou Dragonfly
- [Outbox transactionnelle](../concepts/transactional-outbox.fr.md) : pourquoi la demande de purge attend la validation
