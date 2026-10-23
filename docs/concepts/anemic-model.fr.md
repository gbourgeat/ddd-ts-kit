[English](anemic-model.md) · **Français**
<!-- translation-of: anemic-model.md sha256:2756a1c906fe892f -->

# Modèle anémique

**Résumé.** Un modèle du domaine anémique a les classes d'un modèle du domaine et aucun de ses
comportements : des objets qui ne font que porter des données, avec les règles métier écrites
ailleurs, dans des gestionnaires (handlers) et des services qui lisent et affectent leurs champs.
Il a l'air d'une conception orientée objet et fonctionne comme des procédures sur des
enregistrements, avec le coût des deux. Le mal, c'est que les règles se retrouvent dupliquées,
sautées par de nouveaux points d'entrée, et perdues pour le lecteur. Cette page montre comment le
reconnaître, un avant et un après sur l'exemple du rendez-vous, ce que les règles du kit
attrapent et n'attrapent pas, et quand un modèle mince est le bon choix.

## À quoi il ressemble

```ts
// AVANT : un porteur de données, et les règles dans le gestionnaire
export class Appointment {
  id!: string;
  practitionerId!: string;
  clientId!: string;
  startsAt!: Date;
  endsAt!: Date;
  status!: 'booked' | 'cancelled';
  cancelledAt?: Date;
  cancellationReason?: string;
}

export class CancelAppointmentHandler {
  async execute(command: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status === 'cancelled') {
      throw new Error('Already cancelled');
    }
    if (appointment.startsAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
      throw new Error('Too late to cancel');
    }

    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = command.reason;

    await this.appointments.save(appointment);
    await this.events.publish({ type: 'appointment-cancelled', id: appointment.id });
  }
}
```

Tout ce qu'un expert du domaine appellerait une règle est dans le gestionnaire. Les
conséquences :

- Le gestionnaire du report a lui aussi besoin de la vérification « pas annulé », et en aura sa
  propre copie, ou l'oubliera.
- Un *job* de rappel, un script d'import ou un test peut affecter `status = 'cancelled'` sans
  aucune vérification et sans `cancelledAt` : le type autorise un rendez-vous annulé sans date
  d'annulation.
- La règle des 24 heures lit l'horloge du système, donc son test doit simuler le temps
  globalement.
- Les erreurs sont génériques : un appelant ne peut distinguer « déjà annulé » de « trop tard »
  que par le texte du message.
- Rien dans le code ne dit « annuler ». Le verbe métier n'existe que comme nom de fichier d'un
  gestionnaire.

## Le même cas d'usage avec le comportement dans le modèle

<!-- checked sample -->
```ts
// APRÈS : l'agrégat décide, le gestionnaire orchestre
import {
  AggregateRoot,
  AuthorizedCommand,
  DomainRefusal,
  Repository,
  type Clock,
  type CommandHandler,
  type DomainEvent,
} from '@ddd-ts-kit/kernel';

// Écrits dans leurs propres fichiers du contexte (l'agrégat complet est sur la page Agrégats) :
declare class TimeSlot {
  readonly startsAt: Date;
  startsWithin(durationMs: number, at: Date): boolean;
}
declare class CancellationReason {
  static of(text: string): CancellationReason;
}
declare class AppointmentCancelled implements DomainEvent {
  constructor(aggregateId: string, occurredAt: Date, reason: CancellationReason);
  readonly name: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}
declare class UnknownAppointment extends DomainRefusal {
  readonly code: 'APPOINTMENT_NOT_FOUND';
  static forAppointment(appointmentId: string): UnknownAppointment;
}
declare class AppointmentAlreadyCancelled extends DomainRefusal {
  readonly code: 'APPOINTMENT_ALREADY_CANCELLED';
  static forAppointment(appointmentId: string): AppointmentAlreadyCancelled;
}
declare class CancellationWindowPassed extends DomainRefusal {
  readonly code: 'CANCELLATION_WINDOW_PASSED';
  static forAppointment(appointmentId: string, startsAt: Date): CancellationWindowPassed;
}
declare class CancelAppointment extends AuthorizedCommand {
  readonly appointmentId: string;
  readonly reason: string;
}

const FREE_CANCELLATION_MS = 24 * 60 * 60 * 1000;

interface AppointmentState {
  readonly slot: TimeSlot;
  readonly status: 'booked' | 'cancelled';
}

export class Appointment extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: AppointmentState,
  ) {
    super(id);
  }

  static rehydrate(id: string, state: AppointmentState): Appointment {
    return new Appointment(id, state);
  }

  cancel(reason: CancellationReason, at: Date): void {
    this.assertNotCancelled();
    this.assertCancellationStillFree(at);
    this.state = { ...this.state, status: 'cancelled' };
    this.record(new AppointmentCancelled(this.id, at, reason));
  }

  private assertNotCancelled(): void {
    if (this.state.status === 'cancelled') {
      throw AppointmentAlreadyCancelled.forAppointment(this.id);
    }
  }

  private assertCancellationStillFree(at: Date): void {
    if (this.state.slot.startsWithin(FREE_CANCELLATION_MS, at)) {
      throw CancellationWindowPassed.forAppointment(this.id, this.state.slot.startsAt);
    }
  }
}

export abstract class AppointmentRepository extends Repository<Appointment> {}

export class CancelAppointmentHandler implements CommandHandler<CancelAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);
    if (appointment === undefined) {
      throw UnknownAppointment.forAppointment(command.appointmentId);
    }

    appointment.cancel(CancellationReason.of(command.reason), this.clock.now());

    await this.appointments.save(appointment);
  }
}
```

Le gestionnaire charge, appelle une intention, enregistre. Il n'a aucun `if` sur l'état métier.
Les règles sont à un seul endroit, s'appliquent à chaque appelant, sont nommées, lèvent des
erreurs précises aux codes stables, et se testent sans base de données, sans horloge et sans
bus :

```ts
given(anAppointment().cancelled())
  .when((appointment) => appointment.reschedule(anotherSlot, at))
  .thenError('APPOINTMENT_ALREADY_CANCELLED');
```

Côte à côte, les deux conceptions des mêmes règles :

![À gauche, un Appointment anémique détient des champs publics, et le gestionnaire d'annulation, le gestionnaire de report et un script d'import les affectent chacun avec leurs propres vérifications, ou sans aucune ; à droite, chaque appelant appelle une intention de la racine d'agrégat Appointment, qui détient les règles, lève des refus nommés et enregistre les événements](../assets/diagrams/anemic-model-before-after.fr.svg)

## Comment le reconnaître

Une revue de conception d'un contexte cherche les signaux ci-dessous. Les deux premiers sont le
modèle anémique lui-même ; les autres l'accompagnent en général.

| Signal | Comment le repérer |
|---|---|
| agrégat anémique | des *setters* publics, ou des méthodes qui ne font qu'affecter ; les règles dans les gestionnaires |
| gestionnaire obèse | des branches sur l'état du domaine, des boucles sur des entités, des calculs de montants |
| obsession des primitifs | `string` ou `number` pour des courriels, de l'argent, des périodes, des statuts, des identifiants d'autres agrégats |
| états invalides représentables | des champs optionnels obligatoires ensemble, un statut plus des dates nullables |
| erreurs génériques | `throw new Error(...)` pour un échec métier, ou une seule classe d'erreur pour de nombreux cas |
| transaction sur plusieurs agrégats | un gestionnaire qui enregistre deux agrégats |
| persistance qui fuit | des entités d'ORM ou des lignes renvoyées à travers une interface de *repository* |
| réutilisation de DTO | un schéma de présentation importé par l'application ou le domaine, ou une réponse qui renvoie un objet du domaine |

Questions rapides pour une revue :

1. Lisez à voix haute les méthodes publiques de l'agrégat. Sont-ce des verbes métier (`cancel`,
   `reschedule`), ou `setStatus`, `update`, `changeX` ? Une méthode qui ne fait qu'affecter son
   argument est un *setter* au nom plus long.
2. Ouvrez un gestionnaire. Contient-il des `if` ou des `switch` sur l'état de l'agrégat ? Chacun
   est une règle qui vit dans la mauvaise couche.
3. Cherchez la même condition dans deux gestionnaires.
4. Comptez les *specs* du domaine face aux *specs* des gestionnaires. Un contexte dont toutes les
   règles sont testées à travers des gestionnaires avec des *fakes*, et dont les agrégats n'ont
   presque aucune *spec*, garde ses règles dans les gestionnaires.
5. Un test pourrait-il construire l'agrégat dans un état que le métier dit impossible ?

## Ce que les règles du kit attrapent, et ce qu'elles n'attrapent pas

| Règle | Attrape |
|---|---|
| `domain/aggregate-encapsulation` | un constructeur public, une propriété publique modifiable, un *setter* sur un agrégat ou une entité |
| `domain/value-object-immutability` | un objet-valeur qui peut changer |
| `domain/value-object-class` | une valeur du modèle écrite comme une fonction qui construit un objet simple, `money(amount, currency) => ({ amount, currency })`, ou une classe d'objet-valeur au constructeur public ou sans fabrique (sous `"stack.values": "classes"`) |
| `domain/no-generic-error` | `throw new Error(...)` dans `domain/` ou `application/` |
| `language/no-technical-name`, `language/glossary-term` | `AppointmentManager`, des noms hors du glossaire |
| `purity/no-system-clock` | `Date.now()` ou `new Date()` dans un gestionnaire ou un agrégat |
| `clean/no-flag-argument` | un paramètre booléen qui tient lieu de deux intentions |
| `application/handler-shape` | une classe de gestionnaire qui a plus que `execute` |
| `test/spec-required`, `test/builder-required` | un agrégat sans *spec* ou sans *builder* |

Le tableau des règles est dans [ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 3. Ensemble, elles
font échouer le code « avant » ci-dessus à plusieurs endroits. Elles ne rendent **pas** un modèle
riche :

- Une méthode `changeStatus(status)` passe toutes les règles et reste un *setter*.
- Un gestionnaire plein de `if (appointment.isCancelled)` passe toutes les règles : le *checker*
  ne compte pas les branches métier dans les gestionnaires.
- Un fichier de *spec* qui existe et ne contient que des `it.todo` passe `test/spec-required`,
  qui vérifie le fichier et non son contenu (README de la CLI, Limites).

Les règles éliminent les formes mécaniques de l'anémie. Le jugement, « cette décision est-elle au
bon endroit ? », revient à quelqu'un qui relit : l'agent `architecture-reviewer` du *plugin*
est écrit pour cela, tout comme une revue humaine centrée sur la couche domaine
([Travailler en équipe](../guides/team-workflow.fr.md)).

## De l'anémique au riche, un pas à la fois

1. Choisissez une règle dans un gestionnaire. Écrivez d'abord la *spec* du domaine : étant donné
   un état, quand l'intention, alors l'événement ou l'erreur.
2. Ajoutez la méthode d'intention sur l'agrégat et déplacez-y la condition. Nommez le refus avec
   `generate error <context> <Refusal> <factory>`, qui écrit une classe nommée d'après le refus,
   et son code dans la liste du contexte :

   ```bash
   npx ddd-ts-kit generate error appointments AppointmentAlreadyCancelled forAppointment
   ```

   Elle écrit `AppointmentAlreadyCancelled.forAppointment()` dans
   `domain/errors/appointment-already-cancelled.error.ts`, son code dans `<context>.codes.ts`
   et son cas dans la *spec*. Sans `--code`, le code est le nom du refus en majuscules séparées
   par des tirets bas, `APPOINTMENT_ALREADY_CANCELLED`.
3. Remplacez les branches du gestionnaire par l'appel unique. Sa *spec* raccourcit : le chemin
   nominal, chaque code d'erreur, rien d'enregistré ni de publié en cas d'échec.
4. Retirez le *setter* ou la propriété publique qu'utilisait le gestionnaire. Le compilateur liste
   les autres appelants ; chacun est une règle qui vivait elle aussi à l'extérieur.
5. Remplacez les primitifs que manipulait la règle par un objet-valeur (`TimeSlot` au lieu de
   deux dates) quand la même comparaison apparaît deux fois.

Faites-le cas d'usage par cas d'usage, en petits *commits*, pas comme une réécriture. Un pas, sur
la règle des 24 heures :

```ts
// Au lieu de : la règle dans le gestionnaire, sur l'horloge du système, avec une erreur générique
if (appointment.startsAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
  throw new Error('Too late to cancel');
}
appointment.status = 'cancelled';

// Écrire : une intention ; l'agrégat vérifie la règle sur l'instant qu'on lui donne
appointment.cancel(reason, this.clock.now()); // lève CancellationWindowPassed
```

## Quand un modèle mince convient

Fowler qualifie le modèle anémique d'anti-patron pour un modèle du domaine. Il ne dit pas que
chaque partie de chaque système a besoin d'un modèle du domaine, et ce kit non plus.

- **Les contextes de soutien et génériques** ont souvent peu à décider. Un contexte `calendars`
  où `SetWorkingHours` remplace une liste d'intervalles valides est surtout de la donnée validée.
  Son agrégat aura quelques méthodes qui vérifient un objet-valeur et affectent. C'est un modèle
  simple qui correspond à un sous-domaine simple, pas un défaut
  ([Domaine et sous-domaines](domain-and-subdomains.fr.md)).
- **Les côtés lecture** sont minces par construction : un gestionnaire de requête renvoie la
  forme que déclare un port, sans aucun agrégat ([CQRS](cqrs.fr.md)).
- **Du CRUD pur** sur des données de référence peut rester du CRUD. Khononov décrit des patrons
  plus simples (transaction script, active record) comme le bon choix pour les sous-domaines dont
  la logique est simple.

Le test n'est pas « combien de méthodes a l'agrégat » mais « y a-t-il des règles métier, et si
oui, où sont-elles ? ». Un agrégat mince dans un contexte sans règles est honnête. Un agrégat
mince à côté d'un gestionnaire de 200 lignes est l'anti-patron.

Ce qui reste obligatoire dans chaque contexte de ce kit, mince ou non : l'arborescence canonique,
les règles d'encapsulation, les erreurs nommées, les tests. Un modèle mince coûte peu sous ces
règles parce que le générateur écrit la structure.

## Limites et quand ne pas l'utiliser

- **Un modèle riche n'est pas un but en soi.** Cacher des affectations triviales derrière des
  méthodes de cérémonie ajoute de la lecture sans ajouter de protection. Enrichissez là où une
  règle existe.
- **Ne poussez pas l'orchestration dans les agrégats** au nom de la richesse. Charger d'autres
  agrégats, appeler des ports et publier sont le travail du gestionnaire ; un agrégat qui reçoit
  un *repository* a échangé un problème contre un autre.
- **N'y poussez pas non plus les règles d'accès.** « Seul le client qui a pris le rendez-vous
  peut l'annuler » est une politique (policy) de la couche application
  ([Invariants, permissions et validation](invariants-permissions-validation.fr.md)).
- **Une partie de la logique ne tient dans aucun agrégat seul.** C'est à cela que sert un service
  du domaine ([Briques du domaine](domain-building-blocks.fr.md)) ; cela ne devient un problème
  que lorsque les services détiennent l'essentiel des règles.

## Sources

- Martin Fowler, « AnemicDomainModel », 2003, martinfowler.com/bliki/AnemicDomainModel.html.
- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapitre 4 « Isolating the Domain »
  (l'interface intelligente et les alternatives en couches) et chapitre 5.
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapitre 1 (anémie et
  perte de mémoire) et chapitre 10.
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapitre 5 « Implementing
  Simple Business Logic » et chapitre 6 « Tackling Complex Business Logic ».
- Robert C. Martin, *Clean Code*, Prentice Hall, 2008, chapitre 6 « Objects and Data
  Structures ».
- Dépôt : `plugin/agents/architecture-reviewer.md` (ce qu'une revue juge au-delà des
  vérifications).

## Voir aussi

- [Agrégats](aggregates.fr.md)
- [Entités et objets-valeurs](entities-and-value-objects.fr.md)
- [Événements du domaine, services du domaine, repositories et fabriques](domain-building-blocks.fr.md)
- [Invariants, permissions et validation](invariants-permissions-validation.fr.md)
- [Domaine et sous-domaines](domain-and-subdomains.fr.md)
- [Code propre](clean-code.fr.md)
- [Stratégie de test](testing-strategy.fr.md)
- [Travailler en équipe](../guides/team-workflow.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
- [Index des concepts](README.fr.md)
