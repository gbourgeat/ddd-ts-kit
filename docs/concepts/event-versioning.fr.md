[English](event-versioning.md) · **Français**
<!-- translation-of: event-versioning.md sha256:27a680a1e449fa46 -->

# Versionner un événement d'intégration

**Résumé.** Un événement d'intégration est un contrat : dès qu'un autre contexte le consomme, le
producteur ne peut plus le changer librement. La politique du kit tient en peu de mots. À
l'intérieur d'une version, seuls les changements additifs et facultatifs sont permis. Tout le
reste (une suppression, un renommage, un changement de type ou de sens) est une nouvelle version,
déclarée à côté de l'ancienne et publiée en même temps qu'elle jusqu'à ce que chaque consommateur
soit passé à la nouvelle ; l'ancienne est alors marquée comme dépréciée, puis retirée. Les
consommateurs ignorent les champs qu'ils ne connaissent pas. Cette page explique pourquoi, ce qui
compte comme cassant, et comment le catalogue généré et le document AsyncAPI rendent le contrat
relisible en revue.

## Pourquoi un événement est plus difficile à changer qu'une API

Une API synchrone a une requête HTTP en vol pendant quelques millisecondes. Un événement vit bien
plus longtemps :

- il attend dans une outbox, une file d'attente ou un journal, parfois des jours dans une file de
  rejet (dead letter) ;
- un fournisseur fondé sur un journal conserve l'historique, et un consommateur créé plus tard
  lit d'anciens événements ;
- le producteur et les consommateurs sont déployés à des moments différents, y compris dans le
  monolithe, dès que des consommateurs détiennent des événements publiés par la livraison (release)
  précédente.

À tout moment, des événements écrits par un ancien producteur sont donc lus par un nouveau
consommateur, et inversement. Les deux sens doivent fonctionner : d'anciennes données avec du
nouveau code (la rétrocompatibilité, backward compatibility) et de nouvelles données avec de
l'ancien code (la compatibilité ascendante, forward compatibility) (Kleppmann, chapitre 4).

![Les deux sens de la compatibilité : des événements écrits par la livraison précédente attendent dans l'outbox, une file d'attente, un journal ou une file de rejet, et sont lus par les consommateurs de la nouvelle livraison (rétrocompatibilité) ; des événements écrits par la nouvelle livraison sont lus par des consommateurs qui tournent encore sur la livraison précédente (compatibilité ascendante)](../assets/diagrams/event-versioning-compatibility.fr.svg)

## La règle

| Changement de `appointments.appointment.booked` | Dans la version ? |
|---|---|
| ajouter un champ facultatif (`locationId`) | oui |
| ajouter une description, un exemple | oui |
| ajouter un champ obligatoire | non : les événements des anciens producteurs, encore en vol, ne l'ont pas |
| supprimer ou renommer un champ (`startsAt` en `start`) | non |
| changer un type (`startsAt` de chaîne en nombre) | non |
| changer une unité ou un sens (`startsAt` de l'UTC à l'heure locale) | non, et c'est le plus dangereux : le schéma ne change pas, rien n'échoue, les données sont fausses |
| restreindre les valeurs acceptées (une énumération perd un membre) | non |
| élargir une énumération que les consommateurs parcourent de façon exhaustive | à traiter comme cassant, sauf si l'on sait que les consommateurs tolèrent les valeurs inconnues |
| renommer le type de l'événement | c'est un autre événement |

L'énoncé normatif est dans [ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 4 (« Événements
d'intégration ») : une enveloppe versionnée, des changements additifs seulement à l'intérieur
d'une version.

**La moitié du contrat qui revient au consommateur** : ignorer les champs inconnus, et ne pas
échouer sur un champ absent quand le schéma le dit facultatif (le lecteur tolérant, tolerant
reader). Un consommateur qui valide strictement et rejette les propriétés inconnues transforme
chaque changement additif du producteur en changement cassant.

Dans le kit, le consommateur lit la charge utile avec la déclaration que publie le producteur : la
tolérance se décide donc là où la charge utile est déclarée. Au lieu d'un schéma qui refuse ce
qu'il ne connaît pas :

```ts
payload: zodSchema(
  z.strictObject({ appointmentId: z.string(), startsAt: z.iso.datetime() }),
), // un consommateur encore sur cette livraison refuse chaque événement qui a gagné un champ
```

écrivez-en un qui garde ce qu'il connaît et laisse tomber le reste, et rendez un ajout
facultatif :

<!-- checked sample -->
```ts
import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  description: 'An appointment was booked.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string(),
      startsAt: z.iso.datetime().describe('Start of the appointment, ISO 8601, UTC.'),
      endsAt: z.iso.datetime().describe('End of the appointment, ISO 8601, UTC.'),
      locationId: z.string().optional().describe('Added later: absent from older events.'),
    }),
  ),
});

// un événement d'un producteur plus récent, avec un champ que cette livraison ne connaît pas encore
const parsed = appointmentBookedV1.parse({
  id: 'e7',
  type: 'appointments.appointment.booked',
  version: 1,
  occurredAt: '2026-10-13T08:00:00.000Z',
  payload: {
    appointmentId: 'a-17',
    startsAt: '2026-11-02T09:00:00Z',
    endsAt: '2026-11-02T09:30:00Z',
    roomName: 'Room 2',
  },
});

export const accepted = parsed.ok; // true : roomName est écarté, locationId peut être absent
```

## Un changement cassant, pas à pas

Le produit décide qu'un rendez-vous peut couvrir plusieurs créneaux consécutifs. `startsAt` et
`endsAt` deviennent une liste.

![La migration de v1 vers v2 sur quatre livraisons : à la livraison 1, appointments déclare v2 et publie les deux ; notifications passe à v2 à la livraison 2 et analytics à la livraison 3 ; à la livraison 4, il ne reste aucun consommateur de v1, v1 est marqué déprécié et cesse d'être publié ; sa déclaration est retirée quand plus aucun événement v1 n'est retenu nulle part](../assets/diagrams/event-versioning-migration.fr.svg)

1. **Déclarer la version 2** dans le `published-language/` du producteur, comme une seconde
   déclaration avec le même `type` et `version: 2`. Une déclaration par événement et par version.
2. **Publier les deux.** Le *publisher* construit les deux événements à partir du même événement
   du domaine. Pendant la migration, chaque réservation produit un v1 et un v2.
3. **Faire passer les consommateurs un par un.** Un consommateur s'abonne avec la déclaration de
   la version qu'il comprend ; un événement d'une autre version du même type est sauté par cet
   abonnement. Un consommateur qui passe à v2 s'abonne à v2 et cesse de traiter v1. Il ne doit
   pas traiter les deux pour le même fait, sinon il traite chaque réservation deux fois : les
   deux événements ont des identifiants différents, donc le registre des événements traités ne
   le repère pas.
4. **Déprécier v1** (`deprecated: true` sur sa déclaration) pour que le catalogue l'affiche, et
   annoncer la date de retrait là où l'équipe suit ce genre de choses.
5. **Cesser de publier v1** dès que le catalogue ne montre plus aucun consommateur, puis retirer
   sa déclaration dès qu'il ne reste plus aucun événement v1 dans une file d'attente, une
   rétention de journal ou une file de rejet qui pourrait être rejouée.

Ce que v1 peut encore exprimer pendant l'étape 2 est une vraie question quand le nouveau modèle
est plus riche : un rendez-vous sur plusieurs créneaux n'a pas de forme v1 fidèle. Les options :
publier v1 avec le premier créneau et accepter la perte pour les anciens consommateurs, ou ne pas
publier v1 dans les cas qu'il ne peut pas exprimer, et dire lesquels dans la description de
l'événement.

Les étapes 1 à 3 dans le code : deux déclarations du même type, un *publisher* qui construit les
deux à partir du même événement du domaine, et un consommateur qui s'abonne à la version qu'il
comprend :

<!-- checked sample -->
```ts
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import {
  Command,
  CommandBus,
  type DomainEvent,
  type IdGenerator,
  type IntegrationEvent,
  type IntegrationEventPublisher,
} from '@ddd-ts-kit/kernel';
import { DomainEventHandler, IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

const instant = z.iso.datetime().describe('ISO 8601, UTC.');

// appointments/published-language/appointment-booked.v1.integration-event.ts : inchangé, sauf sa
// description, qui dit ce que v1 ne peut pas exprimer
export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  description: 'An appointment was booked. For an appointment over several slots: its first slot only.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string(),
      startsAt: z.iso.datetime().describe('Start of the appointment, ISO 8601, UTC.'),
      endsAt: z.iso.datetime().describe('End of the appointment, ISO 8601, UTC.'),
      locationId: z.string().optional().describe('Added later: absent from older events.'),
    }),
  ),
});

// appointments/published-language/appointment-booked.v2.integration-event.ts : le nouveau contrat
export const appointmentBookedV2 = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 2,
  description: 'An appointment was booked, over one or several consecutive slots.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string(),
      slots: z.array(z.object({ startsAt: instant, endsAt: instant })).min(1),
    }),
  ),
});

// appointments/domain/events/appointment-booked.event.ts
export class AppointmentBooked implements DomainEvent {
  static readonly eventName = 'appointments.appointment.booked';

  readonly name = AppointmentBooked.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly slots: readonly { readonly startsAt: Date; readonly endsAt: Date }[],
  ) {}
}

// appointments/application/integration/publishers/appointment-booked.publisher.ts
@DomainEventHandler(AppointmentBooked)
export class AppointmentBookedPublisher implements DomainEventHandler<AppointmentBooked> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentBooked): Promise<void> {
    const slots = event.slots.map(({ startsAt, endsAt }) => ({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }));
    const [first] = slots;

    if (first === undefined) {
      return;
    }

    // deux événements avec deux identifiants : un consommateur ne doit s'abonner qu'à une seule version
    await this.publisher.publish([
      appointmentBookedV1.create(
        { appointmentId: event.aggregateId, ...first },
        { id: this.ids.next(), occurredAt: event.occurredAt },
      ),
      appointmentBookedV2.create(
        { appointmentId: event.aggregateId, slots },
        { id: this.ids.next(), occurredAt: event.occurredAt },
      ),
    ]);
  }
}

// notifications/application/integration/handlers/remind-on-appointment-booked.integration-handler.ts
export class ScheduleReminder extends Command {
  constructor(
    readonly appointmentId: string,
    readonly startsAt: string,
  ) {
    super();
  }
}

@IntegrationEventHandler(appointmentBookedV2, { consumer: 'notifications.remind-on-appointment-booked' })
export class RemindOnAppointmentBooked implements IntegrationEventHandler<PayloadOf<typeof appointmentBookedV2>> {
  constructor(private readonly commands: CommandBus) {}

  // un événement v1 du même type est sauté par cet abonnement
  async handle(event: IntegrationEvent<PayloadOf<typeof appointmentBookedV2>>): Promise<void> {
    for (const slot of event.payload.slots) {
      await this.commands.execute(new ScheduleReminder(event.payload.appointmentId, slot.startsAt));
    }
  }
}
```

L'étape 4 tient en une ligne sur l'ancienne déclaration, `deprecated: true`, que montrent le
catalogue et le document AsyncAPI ; l'étape 5 retire la moitié v1 du *publisher*, puis la
déclaration.

## Rendre le contrat visible

Chaque déclaration alimente deux documents générés
(`events/defined-in-published-language`) :

- **le catalogue des événements** (Markdown) : par producteur, chaque événement, ses versions,
  les champs de sa charge utile mis à plat, ses consommateurs ;
- **le document AsyncAPI** : un canal par type d'événement, un message par version, l'enveloppe
  comme charge utile.

Les deux sont commités, régénérés par le script d'événements du projet, et contrôlés en CI contre
toute dérive. Un changement d'un événement apparaît donc comme un diff de fichiers générés dans la
*pull request*, et c'est là qu'une personne qui relit voit qu'un « petit refactoring » a modifié un
contrat. Les descriptions de champs écrites dans le schéma se retrouvent dans les deux.

La politique de versionnement elle-même (combien de temps une ancienne version reste publiée,
comment son retrait s'annonce) est écrite par l'équipe dans `docs/integration/README.md` ; le
*skill* `document` la range parmi les sections de ce fichier.

## Ce que le kit vérifie et ce qu'il ne vérifie pas

| Vérifié | Par |
|---|---|
| un événement est déclaré une fois par version, dans un langage publié, avec un schéma de charge utile | `events/defined-in-published-language` |
| le format du nom | `events/name-format` |
| ce qui est publié et consommé correspond au schéma | la déclaration valide des deux côtés ; publier un événement invalide lève une erreur, une charge utile consommée invalide part en nouvelle tentative puis en file de rejet |
| les documents générés sont à jour | la porte de dérive de la documentation du *pipeline* |

Non vérifié, d'après ce qu'indiquent les README : **la compatibilité entre deux révisions d'une
même version**. Rien ne compare le schéma de v1 dans ce *commit* avec celui de v1 dans le *commit*
précédent pour refuser un champ supprimé. Le garde-fou est le diff du catalogue généré, en revue.
Un registre de schémas avec des modes de compatibilité, comme il en existe dans l'écosystème
Kafka, ne fait pas partie du kit.

## Des pratiques qui réduisent le besoin de versions

- Publier moins. Un champ que personne n'a demandé est un champ qu'on ne pourra pas retirer.
- Préférer des identifiants et des faits à des structures recopiées de l'agrégat.
- Mettre les unités et les fuseaux horaires dans les noms ou les descriptions (`startsAt`,
  ISO 8601, UTC).
- Modéliser les vocabulaires fermés délibérément, et dire aux consommateurs si de nouvelles
  valeurs peuvent apparaître.
- Ajouter des champs facultatifs plutôt que réaffecter des champs existants.

## Limites et quand ne pas l'utiliser

- **Publier deux versions a un coût** : deux fois plus d'événements, un *publisher* avec deux
  conversions, et une migration qui dépend du calendrier d'autres équipes. Pour un changement
  cassant avec un seul consommateur, tenu par la même équipe, dans un seul déployable, il est
  tentant de livrer le producteur et le consommateur ensemble ; cela ne marche que si aucun
  événement v1 n'est en vol ni retenu, ce que l'outbox et les files de rejet rendent difficile à
  garantir. Le chemin à deux versions est le choix sûr par défaut.
- **L'additif seul s'accumule.** Au bout de quelques années, une version porte des champs
  facultatifs dépréciés. Une nouvelle version est aussi l'occasion de faire le ménage.
- **Les changements de sens sont invisibles pour les schémas.** Aucun outil ici ne détecte qu'un
  champ a gardé son nom et changé de sens. Traitez un changement de sens comme un nouveau champ ou
  une nouvelle version.
- **L'*upcasting* vaut pour les événements stockés, pas pour les événements d'intégration.** Les
  événements qu'un agrégat en *event sourcing* garde dans son flux sont convertis (*upcast*) à la
  lecture (les `upcasters` de `defineStoredEvent`, tenus par `event-sourcing/upcaster-required`
  contre `stored-events.lock.json`) : voir [L'event sourcing, par agrégat](event-sourcing.fr.md).
  Les événements d'intégration ne le sont pas : un consommateur qui doit lire un historique
  retenu traite les versions que contient cet historique.
- **Versionner l'événement ne versionne pas le processus.** Quand la suite des événements change
  (une nouvelle étape entre la réservation et la confirmation), les consommateurs qui supposaient
  l'ancienne suite cassent sans aucun changement de schéma. C'est un changement de contrat à
  discuter avec les équipes en aval (voir [Travail en équipe](../guides/team-workflow.fr.md)).

## Sources

- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapitre 4 (« Encoding
  and Evolution »).
- Greg Young, Versioning in an Event Sourced System, Leanpub, 2017 (écrit pour l'*event
  sourcing* ; le raisonnement sur la compatibilité s'applique).
- Martin Fowler, « TolerantReader », 2011, https://martinfowler.com/bliki/TolerantReader.html
- Gregor Hohpe et Bobby Woolf, Enterprise Integration Patterns, Addison-Wesley, 2003 (Format
  Indicator, Message Translator).
- Sam Newman, Building Microservices, 2e édition, O'Reilly, 2021, chapitre 5 (gérer le
  changement entre services : expand and contract, versions qui coexistent).
- Spécification AsyncAPI 3.0.0, https://www.asyncapi.com/docs/reference/specification/v3.0.0
- README de [`@ddd-ts-kit/events`](../../packages/events/README.fr.md).

## Voir aussi

- [Événements du domaine et d'intégration](domain-and-integration-events.fr.md)
- [Livraison et idempotence](delivery-and-idempotency.fr.md)
- [Outbox transactionnelle](transactional-outbox.fr.md)
- [Carte des contextes](context-map.fr.md)
- [Travail en équipe](../guides/team-workflow.fr.md)
- [Brokers de messages](../tools/message-brokers.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
