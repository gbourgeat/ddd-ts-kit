[English](cqrs.md) · **Français**
<!-- translation-of: cqrs.md sha256:b84f801c87e18d6c -->

# CQRS tel qu'utilisé ici

**Résumé.** La séparation des responsabilités entre commandes et requêtes (Command Query
Responsibility Segregation, CQRS) sépare le code qui change l'état du code qui répond aux
questions. Ce kit en applique la forme légère : chaque cas d'usage est soit une commande, soit
une requête, chacune avec un seul gestionnaire (handler) et atteinte par un bus de commandes ou
un bus de requêtes. Une commande passe par l'agrégat et renvoie au plus un identifiant ; une
requête ne change jamais l'état et peut lire une projection par un port sans charger d'agrégats. Les
agrégats gardent leur état dans des tables, sauf si l'on choisit d'en faire passer un à l'*event
sourcing*, et il n'y a pas de seconde base de données par défaut. Cette page dit ce que cela
apporte, ce que cela n'apporte pas, et quand la séparation ne vaut pas la peine.

## D'une règle de méthode à une règle d'architecture

La séparation commande-requête de Bertrand Meyer est une règle qui porte sur les méthodes : une
méthode change l'état ou renvoie une valeur, pas les deux. Greg Young et Udi Dahan l'ont élevée au
niveau du modèle : utiliser un modèle pour écrire et un autre pour lire, parce que les deux ont
des formes et des charges différentes. Le résumé et la mise en garde de Fowler font référence : la
séparation aide dans une minorité de domaines complexes et ajoute du risque ailleurs.

Le kit en prend la partie qui coûte peu et rapporte dans chaque projet :

| Élément | Règle dans ce kit |
|---|---|
| un cas d'usage | une commande ou une requête, dans son propre dossier, avec un seul gestionnaire |
| une commande | change l'état par un seul agrégat ; ne renvoie rien ou un identifiant |
| une requête | ne change rien ; renvoie une vue taillée pour l'appelant |
| le point d'entrée | `CommandBus` et `QueryBus`, jamais une classe de gestionnaire |
| ce qui est commun à tous les cas d'usage | un *middleware* de bus, pas du code répété dans les gestionnaires |

Le texte normatif est [ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 4 (« Cas d'usage »,
« Bus ») ; la forme d'un gestionnaire est `application/handler-shape`, et une requête qui
enregistre, supprime ou publie est signalée par `application/command-query-separation`.

## Les deux chemins, sur l'application de prise de rendez-vous

![Les deux chemins d'un contexte : POST /appointments passe par le bus de commandes et ses middlewares jusqu'au gestionnaire de BookAppointment, qui change l'agrégat Appointment et l'enregistre par son port de repository ; GET /appointments passe par le bus de requêtes jusqu'au gestionnaire de SearchAppointments, qui interroge un port de lecture ; les deux adaptateurs lisent et écrivent les mêmes tables appointments](../assets/diagrams/cqrs-two-paths.fr.svg)

**Commande.** `BookAppointment` porte l'acteur et le créneau demandé. Le gestionnaire charge ce
dont il a besoin, appelle une seule méthode d'intention (`Appointment.book(...)`), enregistre par
le port du *repository* et ne fait rien d'autre : l'enregistrement transmet les événements
enregistrés, et l'unité de travail les distribue une fois que le gestionnaire a rendu la main,
avant la validation (commit). Il renvoie l'identifiant du nouveau rendez-vous et rien d'autre :
le client qui veut afficher le rendez-vous envoie `GetAppointment`. Renvoyer l'agrégat entier
lierait la réponse au modèle d'écriture.

**Requête.** `SearchAppointments` a besoin de vingt lignes de cinq colonnes, filtrées selon ce
que l'acteur a le droit de voir, et paginées. Charger vingt agrégats avec leurs invariants pour
jeter l'essentiel de leur état est du gaspillage. Le gestionnaire interroge un port de lecture,
dont l'adaptateur interroge directement les tables et renvoie la forme que déclare le port. Le
périmètre d'accès calculé par l'*authorizer* entre dans cette requête SQL, de sorte que rien
n'est filtré en mémoire après le chargement (voir
[Authentification et autorisation](authentication-and-authorization.fr.md)).

Les deux chemins lisent les mêmes tables. Le côté lecture est un autre chemin de code, pas une
autre base de données.

### Le chemin des requêtes dans le code

Une requête nomme sa réponse dans son type, un port de lecture déclare la forme dont l'appelant a
besoin, et le gestionnaire interroge le port. Le bus déduit la réponse de la requête, si bien que
la route obtient un résultat typé sans connaître le gestionnaire :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedQuery, InMemoryQueryBus, type Actor, type BusMiddleware, type Logger } from '@ddd-ts-kit/kernel';
import { QueryHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

const appointmentsPermissions = definePermissions('appointments', {
  'appointment.search': { description: 'Search the appointments of a practitioner' },
});

// application/ports/appointment-lines.port.ts : la forme dont l'écran a besoin, pas l'agrégat
export interface AppointmentLine {
  readonly id: string;
  readonly startsAt: string;
  readonly clientName: string;
}

export abstract class AppointmentLines {
  abstract ofPractitioner(practitionerId: string, limit: number): Promise<readonly AppointmentLine[]>;
}

// application/queries/search-appointments/search-appointments.query.ts
@Requires(appointmentsPermissions['appointment.search'])
export class SearchAppointments extends AuthorizedQuery<readonly AppointmentLine[]> {
  constructor(
    actor: Actor,
    readonly practitionerId: string,
  ) {
    super(actor);
  }
}

// application/queries/search-appointments/search-appointments.handler.ts : lit, n'enregistre jamais
@QueryHandler(SearchAppointments)
export class SearchAppointmentsHandler implements QueryHandler<SearchAppointments> {
  constructor(private readonly lines: AppointmentLines) {}

  execute(query: SearchAppointments): Promise<readonly AppointmentLine[]> {
    return this.lines.ofPractitioner(query.practitionerId, 20);
  }
}

// platform/buses/ : ce par quoi passe chaque requête, écrit une fois pour toutes
declare const logger: Logger;
declare const lines: AppointmentLines; // l'adaptateur que la plateforme lie au port

const logged: BusMiddleware = async (message, next, info) => {
  logger.info('use case', { kind: info.kind, name: info.name });

  return next();
};

const queryBus = new InMemoryQueryBus()
  .use(logged)
  .register(SearchAppointments, new SearchAppointmentsHandler(lines), { context: 'appointments' });

// presentation/ : la route connaît le bus et la requête, jamais le gestionnaire
export async function appointmentsOf(actor: Actor, practitionerId: string): Promise<readonly AppointmentLine[]> {
  return queryBus.execute(new SearchAppointments(actor, practitionerId));
}
```

Dans un projet généré, les bus sont construits dans `src/platform/buses/`. Dans le style déclaré,
les gestionnaires sont enregistrés à partir de leurs déclarations ; dans le style explicite, le
module du contexte appelle `register` pour chacun, comme le fait l'exemple pour montrer ce que
contient le bus (voir [Ports et composition](ports-and-composition.fr.md)).

### Deux habitudes que tiennent les règles

Au lieu d'une commande qui rend l'agrégat à l'appelant :

```ts
export class BookAppointment extends AuthorizedCommand<Appointment> { /* ... */ }
// la route sérialise l'agrégat : la réponse est désormais liée au modèle d'écriture
```

écrivez une commande qui renvoie son identifiant, et une requête pour ce qu'affiche le client :

```ts
export class BookAppointment extends AuthorizedCommand<string> { /* ... */ }
const id = await commandBus.execute(new BookAppointment(actor, calendarId, startsAt));
const appointment = await queryBus.execute(new GetAppointment(actor, id));
```

Au lieu d'une requête qui change l'état au passage :

```ts
async execute(query: GetAppointment): Promise<AppointmentView> {
  const appointment = await this.appointments.findById(query.appointmentId);
  appointment.markSeenBy(query.actor.id);
  await this.appointments.save(appointment); // application/command-query-separation
  return toView(appointment);
}
```

écrivez le changement comme une commande à part entière (`MarkAppointmentSeen`), envoyée par
l'appelant qui la veut, et gardez la requête comme une pure lecture.

## Pourquoi des bus

Une route pourrait appeler directement un gestionnaire. Les bus existent pour trois raisons :

1. **Un seul endroit pour ce dont chaque cas d'usage a besoin.** La plateforme générée
   (`src/platform/buses/`) place sur les bus, sous forme de *middlewares* et du plus extérieur au
   plus intérieur : la remontée d'un échec inattendu (quand la *stack* comprend un outil de suivi
   des erreurs), l'entrée de journal, la mesure, le contrôle de permission, le *span* du cas
   d'usage, la mise en attente d'un fichier déposé et le réveil du relais de l'outbox (commandes
   seulement, quand la *stack* les comprend), l'entrée d'audit (quand le journal d'audit est
   activé) et, pour les commandes, l'unité de travail. Un gestionnaire ne contient rien de tout
   cela, donc rien de tout cela ne peut être oublié dans un nouveau gestionnaire.

   ![Les middlewares des bus générés, du plus extérieur au plus intérieur : remontée d'erreur, journal, mesure, permission, span, fichier déposé, réveil du relais, entrée d'audit et unité de travail autour d'un gestionnaire de commande ; remontée d'erreur, journal, mesure, permission, span et entrée d'audit autour d'un gestionnaire de requête ; les parties qui dépendent de la stack sont marquées](../assets/diagrams/cqrs-middlewares.fr.svg)
2. **Un seul point d'entrée pour chaque appelant.** Une route, un gestionnaire d'événement
   d'intégration et un *job* planifié envoient tous une commande. Le cas d'usage est autorisé,
   audité et exécuté dans une transaction de la même façon, quel que soit celui qui l'a lancé.
3. **Une couture.** Les bus sont des ports du noyau avec des implémentations dans le processus.
   Un autre transport est un adaptateur choisi dans la racine de composition ; les appelants ne
   changent pas.

Le prix est un niveau d'indirection : « aller à la définition » sur `execute` mène au bus, pas au
gestionnaire. Le gestionnaire vit à côté de sa commande, dans le même dossier, et c'est ainsi
qu'on le trouve.

## Ce que cela apporte

- **Les cas d'usage sont visibles.** La liste des commandes et des requêtes d'un contexte est sa
  surface fonctionnelle : `ddd-ts-kit describe <context>` l'affiche, et une permission est
  déclarée sur chacune (`authz/declared`).
- **Les lectures cessent de tordre le modèle.** Un agrégat est dimensionné pour ses invariants
  (voir [Agrégats](aggregates.fr.md)), pas pour les écrans qui l'affichent. Une nouvelle colonne
  dans une liste est un changement d'un adaptateur de lecture.
- **Chaque côté est testé comme il le mérite** : le comportement pour les commandes, la forme
  renvoyée pour les requêtes.
- **Les commandes sont faciles à rendre idempotentes et à auditer** : ce sont des données
  nommées, envoyées par un seul endroit.
- **La porte vers un stockage de lecture séparé reste ouverte.** Un port de lecture peut plus
  tard être servi par une projection alimentée par des événements, comme l'est `availability`,
  sans toucher aux appelants.

## Ce que cela n'apporte pas, et ce que le kit ne fait pas

- **L'*event sourcing* est un choix par agrégat, il ne fait pas partie de CQRS.** Les agrégats
  sont stockés sous forme d'état par défaut, et leurs événements du domaine sont enregistrés pour
  être distribués à la fin de l'unité de travail, pas pour les reconstruire. CQRS et l'*event
  sourcing* sont des patrons indépendants que l'on présente souvent ensemble : un agrégat dont
  l'historique est le métier peut passer à l'*event sourcing* pendant que les autres gardent
  leurs lignes ([L'event sourcing, par agrégat](event-sourcing.fr.md)).
- **Pas de base de lecture séparée, et pas de stockage de lecture généré.** Une projection est
  une table du contexte consommateur. Les *packages* d'exécution portent le côté lecture : `Criteria` (les
  filtres, le tri et la page d'une liste, vérifiés contre une définition), l'hydratation, le port
  `ReadModelStore` avec un registre en table SQL, les déclarations `@Projection` et `@On` d'un
  projecteur et une reconstruction (README du kernel, « Criteria », « Hydration » et
  « Projections »). La CLI en génère une partie : `generate query --search` écrit un port de
  lecture avec un adaptateur en mémoire et un *fake*, et
  `generate projection <context> <Name> <event-type>` écrit un projecteur et sa *spec*, dans le
  les deux styles (dans le style explicite sur tsyringe, le fichier de module du contexte
  l'inclut par `builder.include(<Name>Projection)` ; sur une plateforme câblée à la main, la
  classe est simple et le module la souscrit sous son nom de consommateur) ; le port du modèle de lecture et son adaptateur de
  stockage viennent de `generate port` et du *package* ORM. L'état de chaque partie est dans la
  [proposition sur le côté lecture](../proposals/read-side.fr.md).
- **Pas de performance en soi.** Deux chemins de code sur une seule base de données passent à
  l'échelle comme une seule base de données.
- **Pas de commandes asynchrones par défaut.** Les bus dans le processus sont attendus (`await`).
  Une commande à laquelle on répond « acceptée » et qui est traitée plus tard est une conception
  que le projet construit sur des événements.

## Quand une projection est le bon modèle de lecture

`availability` répond à `FindOpenSlots`. La réponse combine les heures de travail et les absences
tenues par `calendars` avec les rendez-vous tenus par `appointments`. Interroger les deux
contextes à chaque recherche couplerait trois contextes à l'exécution. À la place,
`availability` garde sa propre table des créneaux ouverts, mise à jour à l'arrivée de
`calendars.calendar.working-hours-changed`, `appointments.appointment.booked` ou
`appointments.appointment.cancelled`. La recherche est une seule requête locale. Le coût est que
la réponse peut avoir un instant de retard : un créneau affiché comme ouvert peut avoir été pris
il y a une seconde, et c'est `appointments` qui refuse la double réservation (voir
[Cohérence à terme](eventual-consistency.fr.md)).

![Une projection comme modèle de lecture : calendars et appointments publient des événements d'intégration par leur outbox ; le projecteur d'availability les applique à sa propre table des créneaux ouverts ; la requête FindOpenSlots lit cette seule table, et la réservation elle-même reste refusée par appointments quand le créneau est pris](../assets/diagrams/cqrs-projection.fr.svg)

Le projecteur applique chaque événement à une ligne, et son registre n'écrit que quand
l'événement est plus récent que celui que tient la ligne, si bien qu'une nouvelle livraison ou un
événement en retard ne change rien :

<!-- checked sample -->
```ts
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { ReadModelStore, stampOf, type IntegrationEvent, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// appointments/published-language/ : ce qu'availability peut savoir d'une réservation
const slotTaken = z.object({ appointmentId: z.string(), calendarId: z.string(), startsAt: z.iso.datetime() });

export const appointmentBooked = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  payload: zodSchema(slotTaken),
});

export const appointmentCancelled = defineIntegrationEvent({
  type: 'appointments.appointment.cancelled',
  version: 1,
  payload: zodSchema(slotTaken),
});

// availability/application/ports/open-slots.port.ts : le modèle de lecture, une ligne par créneau
export interface OpenSlotRow {
  readonly calendarId: string;
  readonly startsAt: string;
  readonly open: boolean;
}

export abstract class OpenSlots extends ReadModelStore<OpenSlotRow> {}

// availability/application/projections/open-slots.projection.ts
const keyOf = ({ calendarId, startsAt }: PayloadOf<typeof appointmentBooked>) => `${calendarId}@${startsAt}`;

@Projection('availability.open-slots')
export class OpenSlotsProjection {
  constructor(private readonly slots: OpenSlots) {}

  @On(appointmentBooked)
  booked(event: IntegrationEvent<PayloadOf<typeof appointmentBooked>>): Promise<ReadModelWrite> {
    // un créneau hors des heures de travail n'a pas de ligne : répondre undefined n'écrit rien
    return this.slots.upsertIfNewer(keyOf(event.payload), stampOf(event), (row) =>
      row === undefined ? undefined : { ...row, open: false },
    );
  }

  @On(appointmentCancelled)
  cancelled(event: IntegrationEvent<PayloadOf<typeof appointmentCancelled>>): Promise<ReadModelWrite> {
    return this.slots.upsertIfNewer(keyOf(event.payload), stampOf(event), (row) =>
      row === undefined ? undefined : { ...row, open: true },
    );
  }
}
```

`FindOpenSlots` lit ensuite `OpenSlots` avec des critères, comme n'importe quel autre port de
lecture. Le projecteur n'envoie aucune commande et ne lit aucun autre contexte : il ne fait que
garder sa table à jour.

## Limites et quand ne pas l'utiliser

- **Un contexte CRUD sans règles** (une liste de salles, un écran de réglages) gagne peu à avoir
  une commande, un gestionnaire, un bus et un port de lecture par opération. Le générateur rend
  les fichiers bon marché à créer, pas à lire. Un contexte `generic`, ou un contexte `supporting`
  mince, peut garder un modèle trivial ; abandonner la séparation pour lui est une décision
  enregistrée, pas une habitude.
- **« Une commande renvoie au plus un identifiant » crée des frictions.** Un client qui a besoin
  de la ressource créée fait un second appel. C'est voulu ; quand l'aller-retour compte, la route
  peut envoyer la requête après la commande et renvoyer son résultat.
- **Lire ses propres écritures n'est pas automatique** dès qu'une lecture vient d'une projection
  alimentée par des événements. Lisez alors cet écran depuis les tables d'écriture, ou concevez
  l'interface pour ce délai.
- **L'ordre des *middlewares* compte, et il est invisible depuis un gestionnaire.** Lisez
  `src/platform/buses/create-command-bus.ts` et `create-query-bus.ts` pour savoir ce qui enveloppe
  un cas d'usage.
- **Un gestionnaire de requête qui a besoin d'une règle du domaine** (un prix, une éligibilité)
  doit appeler le domaine pour l'obtenir, pas la recopier en SQL. Contourner les agrégats sert la
  forme, pas la logique.

## Sources

- Bertrand Meyer, Object-Oriented Software Construction, 2e édition, Prentice Hall, 1997
  (séparation commande-requête).
- Greg Young, « CQRS Documents », 2010, https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf
- Martin Fowler, « CQRS », 2011, https://martinfowler.com/bliki/CQRS.html
- Martin Fowler, « Event Sourcing », 2005, https://martinfowler.com/eaaDev/EventSourcing.html
- Vaughn Vernon, Implementing Domain-Driven Design, Addison-Wesley, 2013, chapitre 4
  (« Architecture », la section sur CQRS).
- Vlad Khononov, Learning Domain-Driven Design, O'Reilly, 2021, chapitre 8 (CQRS).

## Voir aussi

- [Couches et règle de dépendance](layers-and-dependency-rule.fr.md)
- [Ports et composition](ports-and-composition.fr.md)
- [Agrégats](aggregates.fr.md)
- [Cohérence à terme](eventual-consistency.fr.md)
- [Événements du domaine et d'intégration](domain-and-integration-events.fr.md)
- [Authentification et autorisation](authentication-and-authorization.fr.md)
- [Proposition sur le côté lecture](../proposals/read-side.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
