[English](resilience.md) · **Français**
<!-- translation-of: resilience.md sha256:4f861fdf6a95bb0f -->

# Résilience

**Résumé.** Un appel qui sort du processus peut être lent, échouer, ou ne jamais répondre. Cinq
patrons traitent ce cas : la nouvelle tentative (retry), le délai d'expiration (timeout), le
disjoncteur (circuit breaker), la cloison (bulkhead) et le cache. Chacun résout un problème
précis, et chacun a un mode de défaillance qui aggrave les choses quand on l'applique sans
réfléchir : une tempête de nouvelles tentatives, un paiement en double, un délai d'expiration qui
laisse le travail tourner, un disjoncteur qui masque une panne, un cache qui sert une décision
périmée. Cette page explique ce que fait chaque patron, quand il nuit, dans quel ordre ils se
composent, et comment le kit les applique depuis l'extérieur du code métier pour qu'un
gestionnaire (handler) n'en contienne jamais.

## Où ils s'appliquent

Les politiques de résilience se posent sur les appels à ce que vous ne contrôlez pas : un système
extérieur (le fournisseur de SMS de `notifications`) ou un autre contexte atteint de façon
synchrone par une *gateway* (`appointments` qui demande à `calendars` les heures d'ouverture).
Elles n'ont rien à faire à l'intérieur d'un cas d'usage, autour d'un *repository* d'agrégats par
défaut, ni dans le domaine.

![Le gestionnaire appelle le port SmsSender ; l'appel traverse des politiques imbriquées posées autour de l'adaptateur, de l'extérieur vers l'intérieur : tracing, logged et timed, cached, retry, disjoncteur, cloison, timeout, puis le client HTTP du fournisseur](../assets/diagrams/resilience-policy-chain.fr.svg)

Le gestionnaire dépend du port et ne voit aucune des boîtes intermédiaires.

## Les cinq patrons

### Délai d'expiration (timeout)

Borne le temps d'attente d'un appelant. Sans lui, un fournisseur qui cesse de répondre retient
une connexion, une requête HTTP et finalement chaque *worker* du processus. Tout appel sortant a
besoin d'un délai d'expiration ; c'est la seule politique qui n'a aucune bonne raison d'être
absente.

**Modes de défaillance.**
- *Un délai d'expiration qui n'annule rien.* Rejeter la promesse n'arrête pas l'appel
  sous-jacent : il continue, garde sa *socket*, et peut encore réussir après que l'appelant a
  abandonné. L'aspect de délai d'expiration du kit n'arrête l'appel que lorsque l'adaptateur
  accepte un signal d'interruption et le transmet.
- *Une écriture expirée est une issue inconnue*, pas un échec. Le SMS a peut-être été envoyé.
- *Des délais plus longs que celui de l'appelant.* Si le client de la route abandonne après 5
  secondes, un délai intérieur de 30 secondes ne fait que gaspiller des ressources. Les budgets
  rétrécissent vers l'intérieur.

Un adaptateur qui peut être annulé prend le signal en dernier paramètre et le remet à l'appel ;
`timeout(2000, { signal: true })` interrompt alors la requête HTTP elle-même, pas seulement
l'attente :

<!-- checked sample -->
```ts
export abstract class SmsSender {
  abstract send(phone: string, text: string, signal?: AbortSignal): Promise<void>;
}

export class HttpSmsSender implements SmsSender {
  constructor(private readonly baseUrl: string) {}

  // `signal` en dernier, sans valeur par défaut : l'aspect de délai d'expiration le remplit
  async send(phone: string, text: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: phone, text }),
      ...(signal === undefined ? {} : { signal }),
    });

    if (!response.ok) {
      throw new Error(`The SMS provider answered ${String(response.status)}.`);
    }
  }
}
```

### Nouvelle tentative (retry)

Rappelle après un échec, en pariant que la panne était passagère (une connexion coupée, un
redémarrage, une brève surcharge). De bonnes nouvelles tentatives attendent entre les essais avec
un recul exponentiel (backoff) et ajoutent de la gigue (jitter), une part aléatoire du délai,
pour que de nombreux appelants ne reviennent pas au même instant.

**Modes de défaillance.**
- *Retenter ce qui ne peut pas être répété sans risque.* Une nouvelle tentative répète l'appel
  tel quel. Débiter une carte ou envoyer un SMS deux fois est un incident métier, sauf si
  l'opération est idempotente, en général grâce à une clé d'idempotence que le fournisseur
  respecte.
- *Les tempêtes de nouvelles tentatives.* Chaque couche qui retente multiplie la charge : trois
  tentatives à chacune de trois couches font vingt-sept appels sur une dépendance qui peine déjà.
  Retentez à une seule couche, la plus proche de la panne.
- *Retenter un refus.* Un refus métier ou une erreur de validation échouera de la même façon à
  chaque fois. Le retry du kit ne répète jamais après une `DomainError`, un circuit ouvert ou une
  cloison pleine.
- *Des nouvelles tentatives synchronisées.* Sans gigue, tous les clients qui ont échoué ensemble
  retentent ensemble.

<!-- checked sample -->
```ts
declare abstract class SmsSender {
  abstract send(phone: string, text: string): Promise<void>;
}

// Au lieu de : une nouvelle tentative écrite dans le cas d'usage, sans backoff, sans gigue ni regard sur ce qui a échoué ;
// elle retente un refus aussi volontiers qu'une connexion coupée, et chaque gestionnaire écrit la sienne
export class SendReminderRetrying {
  constructor(private readonly sms: SmsSender) {}

  async execute(phone: string): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.sms.send(phone, 'Your appointment is tomorrow.');
        return;
      } catch (error) {
        if (attempt === 3) {
          throw error;
        }
      }
    }
  }
}

// Écrire : le gestionnaire appelle le port une fois ; la politique est posée sur la liaison de l'adaptateur,
// où elle se lit, se règle et se teste en un seul endroit (voir « Trois formes, une implémentation »)
export class SendReminder {
  constructor(private readonly sms: SmsSender) {}

  async execute(phone: string): Promise<void> {
    await this.sms.send(phone, 'Your appointment is tomorrow.');
  }
}
```

### Disjoncteur (circuit breaker)

Compte les échecs consécutifs d'une dépendance et, au-delà d'un seuil, refuse aussitôt les appels
pendant un moment au lieu de laisser chacun attendre son délai d'expiration. Après la pause, il
laisse passer un appel d'essai (semi-ouvert, *half-open*) et se referme en cas de succès. Il
protège l'appelant (un échec rapide) et l'appelé (de la marge pour se rétablir).

![Les trois états d'un circuit : fermé laisse passer les appels et compte les échecs consécutifs ; au-delà du seuil, il s'ouvre et refuse aussitôt avec CIRCUIT_OPEN ; après le délai de réinitialisation, il est semi-ouvert et laisse passer un appel d'essai, qui le referme en cas de succès et le rouvre en cas d'échec](../assets/diagrams/resilience-circuit-breaker-states.fr.svg)

**Modes de défaillance.**
- *Un disjoncteur qui masque une vraie panne.* Les appels sont refusés vite et en silence, les
  tableaux de bord de latence ont l'air sains, et personne ne remarque qu'aucun rappel n'est
  parti depuis une heure. Publiez l'état de chaque circuit sous forme de métrique et alertez sur
  « ouvert ».
- *Un circuit pour trop de choses.* Un disjoncteur partagé par toutes les méthodes d'un
  adaptateur s'ouvre pour tout le monde quand un seul point d'accès (endpoint) échoue. Le kit
  garde par défaut un circuit par instance et par méthode.
- *Un état par processus.* Chaque instance apprend seule que le fournisseur est tombé ; avec de
  nombreuses instances, la dépendance reçoit encore de nombreux appels d'essai.
- *Des refus métier comptés comme des échecs* ouvrent le circuit sur un trafic normal. Une
  `DomainError` n'est pas un échec pour le disjoncteur du kit.

### Cloison (bulkhead)

Borne le nombre d'appels simultanés vers une dépendance, et refuse au-delà. Le nom vient des
compartiments étanches d'un navire : un fournisseur de SMS lent peut remplir son propre
compartiment, mais il ne peut pas prendre toutes les connexions du processus et couler la
réservation avec lui.

**Modes de défaillance.** Une limite trop basse refuse un trafic sain ; une file d'attente
devant elle transforme les refus en latence et en mémoire. Comme pour le disjoncteur, son état
est propre au processus.

### Cache

Répond à une lecture répétée depuis la mémoire ou depuis un stockage partagé au lieu d'appeler
de nouveau. Il réduit la latence et la charge, et il peut garder une lecture en état de marche
pendant que sa source est brièvement indisponible.

**Modes de défaillance.**
- *Des données périmées présentées comme fraîches.* Toute réponse en cache est une réponse du
  passé. La durée de vie est une décision métier : pendant combien de temps les heures
  d'ouverture peuvent-elles être fausses ?
- *Un agrégat en cache.* Un agrégat servi depuis un cache derrière son *repository* cache qu'il
  est périmé, et la commande suivante décide sur un état ancien : un rendez-vous réservé sur un
  créneau pris il y a une seconde. L'aspect de cache du kit refuse les *repositories* et les cas
  d'usage sauf autorisation explicite, ce qui est une décision à enregistrer. Mettez en cache les
  lectures des *gateways* et des systèmes extérieurs, jamais le modèle sur lequel vous décidez.
- *La ruée (stampede).* Quand une entrée populaire expire, chaque requête qui la manque la
  recalcule au même moment. Partager un seul calcul entre les appelants simultanés (single
  flight) règle le problème à l'intérieur d'un processus ; entre processus, il faut un verrou,
  comme le décrit [`@ddd-ts-kit/redis`](../../packages/redis/README.fr.md).
- *Mettre en cache des échecs ou des réponses propres à un utilisateur sous une clé partagée.*
  Une mauvaise clé fait fuir la réponse d'un utilisateur vers un autre.

## Tableau récapitulatif

| Patron | Protège contre | Mode de défaillance typique | Demande |
|---|---|---|---|
| délai d'expiration | l'attente sans fin | le travail qui continue derrière ; l'issue inconnue d'une écriture | un signal d'interruption transmis à l'appel |
| nouvelle tentative | les pannes passagères | les doublons ; les tempêtes | une opération idempotente ; du backoff et de la gigue |
| disjoncteur | le martèlement d'une dépendance tombée | une panne silencieuse | une métrique et une alerte sur son état |
| cloison | une dépendance qui épuise les ressources partagées | le refus d'un trafic sain | une limite dimensionnée à partir de mesures |
| cache | les lectures répétées, une brève indisponibilité | des décisions périmées | une durée de vie choisie par le métier ; des lectures seulement |

## Ordre de composition

Les politiques s'enveloppent les unes les autres, et l'ordre change le sens. À lire de
l'extérieur vers l'intérieur :

```
tracing, logged, timed, cached, retry, circuitBreaker, bulkhead, timeout, l'adaptateur
```

- **Retry à l'extérieur de timeout** : chaque tentative a sa propre limite de temps. Dans
  l'autre sens, une seule limite couvre toutes les tentatives et les attentes entre elles.
- **Disjoncteur à l'intérieur de retry** : chaque tentative en échec compte pour le seuil, et un
  circuit ouvert met fin aussitôt aux nouvelles tentatives, puisqu'un circuit ouvert n'est pas
  retenté.
- **Journalisation et métriques à l'extérieur de retry** : une mesure par appel tel que
  l'appelant l'a vécu, nouvelles tentatives comprises.
- **Cache à l'extérieur de retry et du disjoncteur** : un succès de cache ne coûte rien et n'est
  pas refusé par un circuit ouvert.

![Retry à l'extérieur de timeout donne à chaque tentative ses propres deux secondes, avec une attente qui grandit entre les tentatives ; timeout à l'extérieur de retry donne deux secondes à toutes les tentatives et aux attentes ensemble, si bien que les dernières tentatives sont coupées](../assets/diagrams/resilience-retry-and-timeout-order.fr.svg)

C'est l'ordre de [`@ddd-ts-kit/aspects`](../../packages/aspects/README.fr.md), et il découle du
code : son `retry` ne répète pas une `CircuitOpenError`. L'autre ordre existe dans la littérature
(un disjoncteur à l'extérieur du retry voit une issue par appel logique) ; le kit ne l'utilise
pas.

## Trois formes, une implémentation

Le kit applique la même politique de trois façons, dans cet ordre de préférence :

1. **Sur une liaison.** Dans le style déclaré, la déclaration de l'adaptateur l'énonce,
   `@Adapter(SmsSender, { kind: 'external', aspects: [ownPolicy(retry(...), timeout(2000))] })`,
   ce qu'écrit `ddd-ts-kit generate adapter` ; dans un module explicite, c'est la liaison qui
   l'énonce, `.with(retry(...), timeout(...))`. Les méthodes de la classe ne contiennent aucune
   politique. `ownPolicy` est une fonction utilitaire du projet
   (`src/platform/resilience/own-policy.ts`) : sur tsyringe, le premier `generate adapter`
   l'écrit, pour qu'un projet sans adaptateur ne contienne aucun fichier que rien n'importe ;
   câblé à la main, c'est `init` qui l'écrit, parce que la plateforme elle-même s'en sert.
2. **Sur toutes les liaisons d'une sorte, dans le module de la plateforme** :
   `builder.around(['external', 'gateway'], ...)`. La plateforme générée
   (`src/platform/resilience/`) donne à chaque adaptateur qui sort du processus et n'énonce
   aucune politique propre trois tentatives avec backoff et une limite de temps par tentative,
   toutes deux lues dans la configuration.
3. **En décorateur sur la classe de l'adaptateur**, dans `infrastructure/` ou la plateforme,
   quand la politique fait partie de ce qu'est l'adaptateur : le client d'un fournisseur qui
   documente ses propres règles de nouvelle tentative.

La première forme, dans un module explicite, avec l'ordre de la page :

<!-- checked sample -->
```ts
import { cached, circuitBreaker, circuitStateGauge, retry, timeout } from '@ddd-ts-kit/aspects';
import { defineContextModule } from '@ddd-ts-kit/di';

declare abstract class SmsSender {
  abstract send(phone: string, text: string, signal?: AbortSignal): Promise<void>;
}
declare class HttpSmsSender implements SmsSender {
  send(phone: string, text: string, signal?: AbortSignal): Promise<void>;
}
declare abstract class WorkingHours {
  abstract findForDay(calendarId: string, day: string): Promise<readonly string[]>;
}
declare class CalendarsWorkingHours implements WorkingHours {
  findForDay(calendarId: string, day: string): Promise<readonly string[]>;
}

export const notificationsModule = defineContextModule({
  name: 'notifications',
  register(builder) {
    builder
      .bind(SmsSender)
      .toClass(HttpSmsSender)
      .as('external')
      .with(
        retry({ attempts: 3 }), // 100 ms qui doublent, avec gigue complète ; jamais après une DomainError
        circuitBreaker({ failureThreshold: 5, resetAfterMs: 30_000, onStateChange: circuitStateGauge() }),
        timeout(2000, { signal: true }), // chaque tentative, interrompue par le signal
      );

    // une lecture d'un autre contexte : combien de temps les heures d'ouverture peuvent-elles être périmées ? le métier dit une minute
    // les entrées restent dans le tenant du travail ; une lecture destinée à tous les tenants ajoute `shared: true`
    builder
      .bind(WorkingHours)
      .toClass(CalendarsWorkingHours)
      .as('gateway')
      .with(cached({ key: (method, args) => `${method}:${args.join(':')}`, ttlMs: 60_000 }), timeout(1000));
  },
});
```

La même politique dans le style déclaré, où `generate adapter` écrit la déclaration, et en
décorateurs de la classe, la forme d'une politique qui appartient à l'adaptateur lui-même :

<!-- checked sample -->
```ts
import { retry, timeout, type Aspect } from '@ddd-ts-kit/aspects';
import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';
import { Adapter } from '@ddd-ts-kit/kernel/declarations';

declare abstract class SmsSender {
  abstract send(phone: string, text: string, signal?: AbortSignal): Promise<void>;
}
declare abstract class Mailer {
  abstract deliver(address: string, body: string): Promise<void>;
}
// src/platform/resilience/own-policy.ts d'un projet généré : cette politique, à la place de celle par défaut
declare function ownPolicy(...policy: readonly Aspect[]): Aspect;
declare function post(path: string, payload: object, signal?: AbortSignal): Promise<void>;

// 1. style déclaré : la politique fait partie de la déclaration, les méthodes n'en contiennent aucune
@Adapter(SmsSender, { kind: 'external', aspects: [ownPolicy(retry({ attempts: 3 }), timeout(2000, { signal: true }))] })
export class HttpSmsSender implements SmsSender {
  async send(phone: string, text: string, signal?: AbortSignal): Promise<void> {
    await post('/messages', { to: phone, text }, signal);
  }
}

// 3. décorateurs : le fournisseur documente ses propres règles de nouvelle tentative ; ownPolicy() sans argument
//    dit à la plateforme que la classe porte sa politique, donc celle par défaut n'est pas ajoutée
@Adapter(Mailer, { kind: 'external', aspects: [ownPolicy()] })
export class ProviderMailer implements Mailer {
  async deliver(address: string, body: string): Promise<void> {
    await this.send({ to: address, body });
  }

  @Retry({ attempts: 3, backoff: { baseMs: 100 } })
  @Timeout(2000, { signal: true })
  async send(payload: object, signal?: AbortSignal): Promise<void> {
    await post('/mails', payload, signal);
  }
}
```

Les cas d'usage reçoivent leur comportement transverse des *middlewares* des bus. Aucune des
trois formes n'est permise dans `domain/` ou `application/` : règle
[`aspects/outside-in`](../ARCHITECTURE.fr.md#3-règles-de-dépendance) et les deux règles
`layer/*`. N'appliquez pas le même aspect sous deux formes : il s'exécuterait deux fois.

Ce qu'enregistre un aspect suit la règle du traçage : classe, méthode, contexte, durée, code
d'erreur ; jamais d'arguments, de résultats ni de messages d'erreur.

## Les appels synchrones sont le cas coûteux

L'essentiel de cette page disparaît quand deux contextes collaborent par des événements.
`notifications` qui réagit à `appointments.appointment.booked` n'a besoin d'aucun délai
d'expiration, d'aucune nouvelle tentative ni d'aucun disjoncteur vers `appointments` : le
*broker* et l'outbox portent les nouvelles tentatives, et le consommateur est idempotent. Les
politiques de résilience sont le prix d'une dépendance synchrone ; préférez une projection
locale alimentée par des événements quand la donnée est souvent nécessaire. Voir
[Livraison et idempotence](delivery-and-idempotency.fr.md).

## Limites, et quand ne pas l'utiliser

- **L'état vit dans le processus**, par instance enveloppée : les circuits, les compartiments et
  le *single flight* ne sont pas partagés entre instances.
- **La nouvelle tentative suppose l'idempotence**, et le kit ne peut pas la vérifier. Seul
  l'auteur de l'adaptateur sait si l'appel peut être répété sans risque.
- **Un délai d'expiration sans signal n'arrête pas l'appel.**
- **Seules les méthodes asynchrones sont enveloppées**, et un appel enveloppé répond toujours une
  promesse : un objet dont les méthodes renvoient un constructeur de requêtes chaînable ne doit
  pas être enveloppé.
- **Une politique n'est pas une garantie de livraison.** Un travail qui ne doit pas être perdu et
  qui doit être retenté pendant des heures appartient à l'outbox et aux événements
  d'intégration, pas à une nouvelle tentative en mémoire qui meurt avec le processus.
- **N'enveloppez pas les *repositories* par réflexe.** Une nouvelle tentative sur la base de
  données à l'intérieur d'une transaction peut répéter la moitié d'une unité de travail ; l'unité
  de travail est la frontière des nouvelles tentatives.
- **Chaque politique ajoute une configuration à régler et un comportement à tester.** Une
  politique se teste une fois, sur l'adaptateur, avec un *fake* qui échoue à la demande ; les cas
  d'usage se testent sans elle.

## Sources

- Michael T. Nygard, Release It!, 2e édition, Pragmatic Bookshelf, 2018, chapitre 5 « Stability
  Patterns » : Timeouts, Circuit Breaker, Bulkheads, Fail Fast.
- Martin Fowler, « CircuitBreaker », martinfowler.com, 2014.
- Marc Brooker, « Exponential Backoff And Jitter », AWS Architecture Blog, 2015 ; « Timeouts,
  retries, and backoff with jitter », Amazon Builders' Library.
- Sam Newman, Building Microservices, 2e édition, O'Reilly, 2021, chapitre 12 « Resiliency ».
- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapitre 8 « The
  Trouble with Distributed Systems » : délais d'expiration et issues inconnues.
- [`@ddd-ts-kit/aspects`](../../packages/aspects/README.fr.md) : les aspects, leurs valeurs par
  défaut, l'ordre et les limites cités plus haut.

## Voir aussi

- [Observabilité](observability.fr.md)
- [*Jobs* planifiés](scheduled-jobs.fr.md)
- [Ports et composition](ports-and-composition.fr.md)
- [Livraison et idempotence](delivery-and-idempotency.fr.md)
- [Outils de cache et de coordination](../tools/cache-and-coordination.fr.md)
- [Cache HTTP](http-caching.fr.md) : le cache devant l'API, et sa purge après la validation
  (commit)
- [Référence de l'architecture](../ARCHITECTURE.fr.md) : « Comportement transverse », règle
  `aspects/outside-in`
