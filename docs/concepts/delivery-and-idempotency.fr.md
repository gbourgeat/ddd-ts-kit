[English](delivery-and-idempotency.md) · **Français**
<!-- translation-of: delivery-and-idempotency.md sha256:1a2bc89c38a14e13 -->

# Garanties de livraison et consommateurs idempotents

**Résumé.** Dans ce kit, les événements d'intégration sont livrés au moins une fois : chaque
événement atteint chaque consommateur, éventuellement plus d'une fois, dans un ordre qui n'est pas
garanti. La livraison exactement une fois n'est pas proposée, ni ici ni ailleurs, parce qu'un
émetteur ne peut pas distinguer un message perdu d'un acquittement perdu. Ce que l'on peut
construire, c'est un effet exactement une fois : un consommateur qui enregistre, dans la même
transaction que son propre changement d'état, qu'il a traité un événement, et qui le saute la
deuxième fois. Cette page explique la garantie, le registre des événements traités, pourquoi il
vit dans la base de données, ce que coûte l'ordre et où vont les événements en échec.

## Trois garanties de livraison

| Garantie | Signification | Prix |
|---|---|---|
| au plus une fois | envoyer et oublier ; une panne perd le message | aucun ; des événements sont perdus |
| au moins une fois | renvoyer jusqu'à l'acquittement ; une panne duplique le message | les consommateurs doivent tolérer les doublons |
| exactement une fois | chaque message livré une seule fois | impossible à obtenir entre des systèmes indépendants |

Pourquoi la troisième n'existe pas : le relais publie `appointments.appointment.booked` et la
connexion tombe avant que l'acquittement n'arrive. Le *broker* l'a-t-il reçu ? Le relais ne peut
pas le savoir. S'il renvoie, l'événement peut être livré deux fois ; s'il ne renvoie pas,
l'événement peut être perdu.

![Pourquoi la livraison exactement une fois est hors de portée : le relais publie l'événement e1, le broker le stocke, l'acquittement se perd au retour ; le relais ne peut pas distinguer ce cas d'un message perdu, il doit donc choisir entre renvoyer, ce qui peut livrer e1 deux fois (au moins une fois), et ne pas renvoyer, ce qui peut le perdre (au plus une fois)](../assets/diagrams/delivery-and-idempotency-lost-ack.fr.svg)

Il en va de même entre le *broker* et le consommateur : le gestionnaire valide sa transaction,
l'acquittement se perd, le *broker* livre de nouveau. Les produits qui annoncent une sémantique
exactement une fois l'obtiennent à l'intérieur de leur propre frontière (par exemple une
transaction Kafka qui couvre des *topics* et des *offsets* Kafka), pas entre un *broker* et la
base de données d'une application (Kleppmann, chapitre 11).

Les doublons relèvent donc du fonctionnement normal, pas de l'incident. Dans le kit, ils
viennent : d'une nouvelle tentative du relais après un acquittement perdu, d'un relais redémarré
entre la publication et le marquage, d'une nouvelle livraison du *broker* après la panne d'un
consommateur, d'une personne de l'exploitation qui rejoue des messages rejetés.

## Consommateurs idempotents

Un consommateur est idempotent quand traiter deux fois le même événement laisse le même état que
le traiter une fois. Certaines opérations le sont naturellement (« marquer le rendez-vous comme
annulé »). La plupart ne le sont pas : `notifications`, s'il traitait deux fois
`appointments.appointment.booked`, planifierait deux rappels.

Le mécanisme général est un **registre des événements traités** : une table dont la clé est le
nom du consommateur et l'identifiant de l'événement.

![Le registre des événements traités dans trois cas : à une première livraison, la marque est posée, le rappel est inséré et les deux sont validés ensemble avant l'acquittement ; à une nouvelle livraison, la marque existe déjà, le gestionnaire est sauté et l'événement est acquitté ; quand le gestionnaire échoue, la transaction est annulée avec la marque, rien n'est acquitté et la nouvelle livraison est traitée](../assets/diagrams/delivery-and-idempotency-processed-events.fr.svg)

Le détail décisif est que **la marque et le changement d'état sont validés ensemble** :

- si le gestionnaire échoue, la marque est annulée avec le reste et la nouvelle livraison est
  traitée ;
- si le gestionnaire réussit, la marque est durable et la nouvelle livraison est sautée ;
- l'acquittement au *broker* vient après la validation, jamais avant.

Le kit le fait pour un gestionnaire d'événement d'intégration déclaré, sans code dans le
gestionnaire : la marque et le travail s'exécutent dans une seule unité de travail, et la
commande qu'envoie le gestionnaire rejoint cette transaction. La règle est
`events/consumer-idempotent` : chaque consommateur a un nom de consommateur stable et unique, et
déduplique par un registre des événements traités.

Un gestionnaire déclaré ne fait que nommer son consommateur ; la plateforme l'abonne avec le
registre des événements traités et l'unité de travail liés dans le conteneur :

<!-- checked sample -->
```ts
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { Command, CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// appointments/published-language/appointment-booked.v1.integration-event.ts
export const appointmentBooked = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  payload: zodSchema(z.object({ appointmentId: z.string(), startsAt: z.iso.datetime() })),
});

// notifications/application/commands/schedule-reminder/schedule-reminder.command.ts
export class ScheduleReminder extends Command {
  constructor(
    readonly appointmentId: string,
    readonly startsAt: string,
  ) {
    super();
  }
}

// notifications/application/integration/handlers/remind-on-appointment-booked.integration-handler.ts
@IntegrationEventHandler(appointmentBooked, { consumer: 'notifications.remind-on-appointment-booked' })
export class RemindOnAppointmentBooked implements IntegrationEventHandler<PayloadOf<typeof appointmentBooked>> {
  constructor(private readonly commands: CommandBus) {}

  // aucune déduplication ici : la marque, cette commande et ses écritures sont validées dans une seule unité de travail
  async handle(event: IntegrationEvent<PayloadOf<typeof appointmentBooked>>): Promise<void> {
    await this.commands.execute(new ScheduleReminder(event.payload.appointmentId, event.payload.startsAt));
  }
}
```

Sans le conteneur, `consume` de `@ddd-ts-kit/events` donne la même sémantique à une simple
fonction. Ici, le *broker* est joué à la main et livre deux fois le même événement ; le rappel est
planifié une seule fois :

<!-- checked sample -->
```ts
import { consume, defineIntegrationEvent } from '@ddd-ts-kit/events';
import { InMemoryProcessedEventStore, InMemoryUnitOfWork } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

const appointmentBooked = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  payload: zodSchema(z.object({ appointmentId: z.string(), startsAt: z.iso.datetime() })),
});

const reminders: string[] = [];

const remindOnBooked = consume(
  appointmentBooked,
  {
    consumer: 'notifications.remind-on-appointment-booked', // une identité : un littéral, jamais un nom de classe
    processed: new InMemoryProcessedEventStore(), // en production, le registre du package ORM
    unitOfWork: new InMemoryUnitOfWork(), // en production, la transaction de la base de données
  },
  async (event) => {
    reminders.push(event.payload.appointmentId);
  },
);

const e1 = appointmentBooked.create(
  { appointmentId: 'a-17', startsAt: '2026-11-02T09:00:00Z' },
  { id: 'e1', occurredAt: new Date('2026-10-13T08:00:00Z') },
);

export async function deliverTwice(): Promise<number> {
  await remindOnBooked.handler(e1); // première livraison : traitée
  await remindOnBooked.handler(e1); // nouvelle livraison après un acquittement perdu : sautée

  return reminders.length; // 1
}
```

### Le nom du consommateur est une identité

Le nom (`notifications.remind-on-appointment-booked`) sert de clé à la table des événements
traités et, derrière un *broker*, nomme la file d'attente, le groupe de consommateurs ou
l'abonnement durable. Il s'écrit comme un littéral et survit au renommage d'une classe. Le
renommer crée un nouveau consommateur qui n'a rien traité : chez un fournisseur qui conserve
l'historique, il rejoue cet historique.

### Pourquoi le registre n'est pas dans Redis

Une marque dans un système et un changement d'état dans un autre, c'est de nouveau une double
écriture. Une panne entre les deux perd l'événement (marque conservée, changement annulé) ou le
traite deux fois (changement validé, marque absente). Le *package* Redis le dit explicitement et
ne fournit aucun registre des événements traités ; les registres sont ceux des *packages* ORM,
dans l'unité de travail du consommateur.

Un cas auquel prendre garde, tiré du README d'events : un consommateur enregistré avec un registre
des événements traités mais sans unité de travail pose sa marque avant que le gestionnaire ne
s'exécute. Avec un registre transactionnel, un gestionnaire qui échoue laisse alors la marque
validée, et la nouvelle livraison est sautée : l'événement est perdu pour ce consommateur.
Utilisez l'unité de travail, ou un registre capable de retirer sa marque.

### Quand le gestionnaire appelle l'extérieur

La transaction couvre la base de données, pas un fournisseur de courriel. Si `notifications`
envoie un SMS dans le gestionnaire et que la validation échoue ensuite, la nouvelle livraison
l'envoie de nouveau. Les options, par ordre de préférence : rendre l'appel extérieur idempotent
avec une clé dérivée de l'identifiant de l'événement, quand le fournisseur en accepte une ;
enregistrer l'intention dans la transaction et laisser une étape séparée, rejouable, l'envoyer ;
accepter le doublon rare quand il est sans conséquence, et le dire.

Au lieu d'un gestionnaire qui cache l'échec du fournisseur :

```ts
async handle(event: IntegrationEvent<AppointmentBookedV1>): Promise<void> {
  try {
    await this.sms.send({ clientId: event.payload.clientId, text: 'Your appointment is booked.' });
  } catch (error) {
    this.logger.warn('sms failed', { error }); // acquitté : l'événement est perdu pour ce consommateur
  }
}
```

écrivez-en un qui laisse l'erreur remonter jusqu'au fournisseur de messagerie, qui retente puis
range l'événement dans la file de rejet, et qui donne à l'appel extérieur une clé sur laquelle le
fournisseur déduplique :

<!-- checked sample -->
```ts
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

// application/ports/sms-sender.port.ts : ce dont notifications a besoin du fournisseur de SMS ;
// son adaptateur cherche le numéro de téléphone, donc l'événement ne porte aucune donnée personnelle
export abstract class SmsSender {
  abstract send(message: { readonly clientId: string; readonly text: string; readonly idempotencyKey: string }): Promise<void>;
}

interface AppointmentBookedV1 {
  readonly appointmentId: string;
  readonly clientId: string;
}

export class ConfirmByText {
  constructor(private readonly sms: SmsSender) {}

  async handle(event: IntegrationEvent<AppointmentBookedV1>): Promise<void> {
    // une nouvelle livraison envoie la même clé : un fournisseur qui la respecte n'envoie le texte qu'une fois
    await this.sms.send({
      clientId: event.payload.clientId,
      text: 'Your appointment is booked.',
      idempotencyKey: `notifications.confirm-by-text:${event.id}`,
    });
  }
}
```

## L'ordre

Par défaut, **l'ordre n'est pas garanti, pas même pour les événements d'un seul agrégat** : un
enregistrement en échec est retenté pendant que ses successeurs partent, plusieurs relais ou
plusieurs instances de consommateur s'entrelacent, et une nouvelle livraison revient après les
messages qui l'ont suivie.

Ainsi `appointments.appointment.cancelled` peut atteindre `availability` avant le `rescheduled`
qui l'a précédé. Trois façons d'y faire face, de la moins coûteuse à la plus coûteuse :

1. **Rendre l'ordre indifférent.** Porter dans la charge utile une version ou un numéro de
   séquence de l'agrégat ; le consommateur garde le plus élevé qu'il a appliqué et ignore tout ce
   qui est plus ancien. Cela fonctionne avec tous les fournisseurs, et c'est ce que recommandent
   les README des fournisseurs.

   ![Rendre l'ordre indifférent : le producteur émet les versions 1, 2 et 3 d'un même rendez-vous ; elles arrivent dans l'ordre 1, 3, 2 ; le consommateur applique 1, puis 3, et ignore 2 parce que la ligne tient déjà une version plus récente, si bien qu'il finit dans l'état de la version 3, quel que soit l'ordre d'arrivée](../assets/diagrams/delivery-and-idempotency-ordering.fr.svg)

   Le noyau compare les estampilles pour vous : `stampOf(event, version)` et `isNewer`, la règle
   qu'appliquent les registres de modèles de lecture dans `upsertIfNewer` :

   <!-- checked sample -->
   ```ts
   import { isNewer, stampOf, type EventStamp, type IntegrationEvent } from '@ddd-ts-kit/kernel';

   interface SlotChanged {
     readonly slotId: string;
     readonly version: number; // par créneau, fixée par le producteur
     readonly state: 'open' | 'taken';
   }

   interface SlotRow {
     readonly state: 'open' | 'taken';
     readonly stamp: EventStamp;
   }

   /** Met le créneau dans l'état que dit l'événement, si l'événement est plus récent que ce que tient la ligne. */
   export function applySlotChanged(row: SlotRow | undefined, event: IntegrationEvent<SlotChanged>): SlotRow {
     const stamp = stampOf(event, event.payload.version);

     if (row !== undefined && !isNewer(stamp, row.stamp)) {
       return row; // plus ancien, ou de nouveau le même événement : rien ne change
     }

     return { state: event.payload.state, stamp };
   }
   ```
2. **Rendre les gestionnaires commutatifs** là où le métier le permet : « mettre le créneau dans
   l'état que dit cet événement, s'il est plus récent » au lieu de « basculer ».
3. **Demander l'ordre par clé.** Le relais peut retenir un enregistrement tant qu'un
   enregistrement antérieur de la même clé n'est pas publié, et un journal comme Kafka garde
   l'ordre d'une partition.

L'ordre par clé a des réserves énoncées (README d'events) : il demande un seul relais ; un
événement qui ne peut pas être publié bloque tous les événements suivants de sa clé jusqu'à ce
qu'il parte ou soit rejeté ; un redémarrage oublie quel enregistrement bloque quelle clé, donc
l'ordre strict à travers les redémarrages n'est pas fourni ; le *broker* et le consommateur
doivent eux aussi garder l'ordre (une partition, ou une file d'attente avec un seul consommateur
actif par clé, et aucune nouvelle tentative dans le désordre). Parmi les fournisseurs du kit, le
README de Kafka se décrit comme celui à choisir quand l'ordre des événements d'un agrégat compte ;
RabbitMQ et NATS déclarent « no ordering ».

L'ordre entre agrégats ou entre contextes n'est jamais disponible. Un flux qui en a besoin est un
processus aux étapes explicites : voir
[Sagas et gestionnaires de processus](sagas-and-process-managers.fr.md).

## Quand un gestionnaire échoue sans cesse

Un gestionnaire lève une erreur ; le fournisseur retente un nombre borné de fois, avec un délai ;
puis l'événement est mis de côté dans une **file de rejet** (dead letter) : une file morte, un
*topic* ou un *stream* de rejet, selon le fournisseur. Un message qui ne peut même pas être lu
comme une enveloppe est empoisonné (poison message) et y va directement. Les règles qui en
découlent :

- laissez le gestionnaire lever l'erreur : avaler l'erreur acquitte l'événement et le perd ;
- un message rejeté est une alerte, pas une ligne de journal : la destination doit être vide en
  fonctionnement normal ;
- rejouez après avoir corrigé la cause ; rejouer un message empoisonné ne fait que le tuer de
  nouveau ;
- seuls des codes voyagent avec un message rejeté, jamais des messages d'erreur, qui peuvent citer
  des données de la charge utile.

Deux faits de plus, communs aux fournisseurs du kit :

- **Une nouvelle livraison exécute de nouveau chaque gestionnaire du consommateur pour ce type**,
  y compris ceux qui ont réussi. Chaque gestionnaire déduplique sur son propre nom de
  consommateur.
- **Le délai entre deux tentatives est constant** dans les quatre fournisseurs de *broker* : pas
  de temporisation exponentielle (exponential backoff) côté consommation.

## Limites et quand ne pas l'utiliser

- **La table des événements traités grossit.** Les README du kit ne décrivent pas de purge pour
  elle ; prévoyez-en une par ancienneté, plus longue que le plus long horizon possible de
  nouvelle livraison et de rejeu. (Le kit ne la fournit pas, d'après ce que disent ses README.)
- **La déduplication se fait par consommateur et par identifiant d'événement.** Deux événements
  différents qui décrivent le même fait (un bogue du producteur, une réémission avec un nouvel
  identifiant) ne sont pas repérés : il faut pour cela une clé métier et une contrainte
  d'unicité.
- **L'idempotence ne donne pas l'ordre**, et l'ordre ne donne pas l'idempotence. Ce sont deux
  conceptions distinctes.
- **Une unité de travail par événement garde une transaction ouverte pendant toute la durée du
  gestionnaire.** Les gestionnaires lents retiennent des connexions ; avec Prisma, les
  transactions interactives sont limitées dans le temps par défaut.
- **Il faut un registre transactionnel côté consommateur.** Un consommateur sans base de données
  utilise le registre en mémoire capable de retirer sa marque, qui ne protège qu'un seul
  processus.
- Quand ne pas s'en soucier : un consommateur dont l'effet est naturellement idempotent et peu
  coûteux (écraser une entrée de cache). La règle demande quand même un nom de consommateur et
  un registre ; l'assouplir est une dérogation enregistrée.

## Sources

- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapitre 11 (livraison
  des messages, idempotence, exactement une fois) et chapitre 8 (réseaux non fiables).
- Chris Richardson, « Idempotent consumer »,
  https://microservices.io/patterns/communication-style/idempotent-consumer.html
- Gregor Hohpe et Bobby Woolf, Enterprise Integration Patterns, Addison-Wesley, 2003
  (Idempotent Receiver, Dead Letter Channel, Resequencer).
- Pat Helland, « Idempotence Is Not a Medical Condition », ACM Queue, 2012.
- Documentation d'Apache Kafka, « Message Delivery Semantics »,
  https://kafka.apache.org/documentation/#semantics
- README de [`@ddd-ts-kit/events`](../../packages/events/README.fr.md),
  de [`@ddd-ts-kit/redis`](../../packages/redis/README.fr.md) et des *packages* de *broker*.

## Voir aussi

- [Outbox transactionnelle](transactional-outbox.fr.md)
- [Événements du domaine et d'intégration](domain-and-integration-events.fr.md)
- [Cohérence à terme](eventual-consistency.fr.md)
- [Versionnement des événements](event-versioning.fr.md)
- [Jobs planifiés](scheduled-jobs.fr.md)
- [Brokers de messages](../tools/message-brokers.fr.md)
- [Cache et coordination](../tools/cache-and-coordination.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
