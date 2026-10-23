[English](layers-and-dependency-rule.md) · **Français**
<!-- translation-of: layers-and-dependency-rule.md sha256:8df50e600da635e5 -->

# Les couches et la règle de dépendance

**Résumé.** Un contexte délimité (bounded context) de ce kit est découpé en quatre couches :
présentation, application, domaine et infrastructure. Une seule règle les gouverne : les
dépendances du code source pointent vers le domaine, et le domaine ne dépend de rien d'autre que
de lui-même et du noyau (le *package* kernel). L'architecture hexagonale, l'architecture en
oignon et la *clean architecture* sont trois noms pour cette même règle, avec des dessins et un
vocabulaire différents. Cette page explique la règle, ce que les trois noms partagent et où ils
diffèrent, comment le kit les fait correspondre à des dossiers, et quel analyseur tient quelle
partie.

## Le problème que la règle résout

Dans une application classique en trois tiers, le code métier appelle le code de la base de
données : le code métier importe donc l'ORM, et chaque règle métier s'écrit en termes de lignes
et de sessions. Deux conséquences en découlent. La règle « un client ne peut pas réserver un
créneau déjà pris » ne peut pas se tester sans base de données, et remplacer ou mettre à jour
l'ORM oblige à modifier des règles métier.

La règle de dépendance inverse le sens de cette seule flèche. Le code métier déclare ce dont il a
besoin sous forme d'abstraction (un port), et le code de la base de données l'implémente. À
l'exécution, l'appel va toujours du code métier vers la base de données ; l'import va dans
l'autre sens.

![Avant et après : en trois tiers, les règles de réservation importent l'ORM ; sous la règle de dépendance, les règles de réservation déclarent un port de repository, l'adaptateur ORM l'importe et l'implémente, et l'appel va toujours des règles vers l'adaptateur à l'exécution](../assets/diagrams/layers-and-dependency-rule-inversion.fr.svg)

Dans le code, la différence tient en un import. Au lieu d'un domaine qui va chercher la base de
données :

```ts
// domain/aggregates/appointment.aggregate.ts
import type { Knex } from 'knex'; // layer/domain-purity : un ORM dans le domaine

export class Appointment {
  static async book(db: Knex, calendarId: string, startsAt: Date) {
    const taken = await db('appointments').where({ calendar_id: calendarId, starts_at: startsAt }).first();
    // la règle s'écrit désormais en termes de lignes, et ne peut pas se tester sans base de données
  }
}
```

écrivez un domaine qui énonce ce dont il a besoin, et une application qui s'en sert sans savoir
qui répond. Les quatre fichiers sont montrés ici comme un seul module ; les commentaires nomment
le fichier où vit chaque partie :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { NamedDomainEvent, 
  AggregateRoot,
  AuthorizedCommand,
  DomainRefusal,
  Repository,
  type Actor,
  type Clock,
  type DomainEvent,
  type IdGenerator,
} from '@ddd-ts-kit/kernel';
import { CommandHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

// domain/ : n'importe rien d'autre que le noyau
export class AppointmentBooked extends NamedDomainEvent('appointments.appointment.booked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

export const AppointmentsCodes = { SlotTaken: 'SLOT_TAKEN' } as const;

export class SlotTaken extends DomainRefusal {
  readonly code = AppointmentsCodes.SlotTaken;

  static forCalendar(calendarId: string, startsAt: Date) {
    return SlotTaken.refusal(`The slot at ${startsAt.toISOString()} is already taken.`, { calendarId, startsAt });
  }
}

export class Appointment extends AggregateRoot {
  private constructor(
    id: string,
    readonly calendarId: string,
    readonly startsAt: Date,
  ) {
    super(id);
  }

  static book(id: string, calendarId: string, startsAt: Date, now: Date): Appointment {
    const appointment = new Appointment(id, calendarId, startsAt);
    appointment.record(new AppointmentBooked(id, now));

    return appointment;
  }
}

// domain/repositories/appointment.repository.ts : le port, une classe abstraite que possède le domaine
export abstract class AppointmentRepository extends Repository<Appointment> {
  abstract isTaken(calendarId: string, startsAt: Date): Promise<boolean>;
}

// application/ : le cas d'usage connaît le port, jamais l'adaptateur qui est derrière
const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment' },
});

@Requires(appointmentsPermissions['appointment.book'])
export class BookAppointment extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    readonly startsAt: Date,
  ) {
    super(actor);
  }
}

@CommandHandler(BookAppointment)
export class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({ calendarId, startsAt }: BookAppointment): Promise<string> {
    if (await this.appointments.isTaken(calendarId, startsAt)) {
      throw SlotTaken.forCalendar(calendarId, startsAt);
    }

    const appointment = Appointment.book(this.ids.next(), calendarId, startsAt, this.clock.now());
    await this.appointments.save(appointment);

    return appointment.id;
  }
}

// infrastructure/persistence/ : l'adaptateur importe le port et l'implémente
export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly rows = new Map<string, Appointment>();

  async findById(id: string): Promise<Appointment | undefined> {
    return this.rows.get(id);
  }

  async save(appointment: Appointment): Promise<void> {
    this.rows.set(appointment.id, appointment);
  }

  async isTaken(calendarId: string, startsAt: Date): Promise<boolean> {
    return [...this.rows.values()].some(
      (held) => held.calendarId === calendarId && held.startsAt.getTime() === startsAt.getTime(),
    );
  }
}
```

La règle « un créneau ne peut pas être réservé deux fois » se lit désormais sans aucune
bibliothèque, et une *spec* l'exécute contre l'adaptateur en mémoire en quelques millisecondes.
L'adaptateur ORM de production (Knex, Drizzle, Prisma ou TypeORM) n'est qu'une classe de plus qui
implémente le même port ; rien au-dessus ne change.

## Les quatre couches, sur l'application de prise de rendez-vous

![Les quatre couches d'un contexte délimité dans la plateforme : la présentation, l'application et l'infrastructure pointent vers le domaine, l'infrastructure implémente les ports de l'application](../assets/diagrams/layers-dependency-rule.fr.svg)

| Couche | Contient | Exemple dans `appointments` | Peut importer |
|---|---|---|---|
| domaine | le modèle : agrégats, entités, objets-valeurs, événements du domaine, erreurs du domaine, ports de *repository*, services du domaine | `Appointment`, `TimeSlot`, `SlotAlreadyTaken`, le port `AppointmentRepository` | son propre domaine, le noyau partagé, le *package* kernel |
| application | les cas d'usage : une commande ou une requête et son gestionnaire, les ports vers l'extérieur, les permissions et les politiques, les réactions aux événements, les *jobs* | `BookAppointment` et son gestionnaire, un port pour lire les heures de travail | le domaine, l'application, les langages publiés, le noyau |
| infrastructure | les adaptateurs : implémentations de *repositories*, clients de systèmes extérieurs, traducteurs anticorruption | l'adaptateur ORM d'`AppointmentRepository`, son *mapper* | les ports qu'elle implémente, des pilotes et des bibliothèques |
| présentation | le point d'entrée : les routes HTTP et leurs DTO, la CLI | `POST /appointments` relié à `BookAppointment` | l'application, les types du domaine pour la conversion |

Les listes exactes d'imports sont les règles `layer/domain-purity`, `layer/application-inward`,
`layer/presentation-no-infrastructure` et `layer/infrastructure-no-presentation` de
[ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 3. Le dossier de chaque rôle est l'arborescence
canonique de la section 2.

Une requête HTTP de réservation traverse les couches ainsi :

![Une requête HTTP de réservation à travers les couches : la route envoie BookAppointment au bus de commandes, le bus exécute le gestionnaire, le gestionnaire demande à l'agrégat Appointment de réserver et l'enregistre par le port du repository, dont l'adaptateur d'infrastructure le stocke ; l'identifiant revient par le même chemin](../assets/diagrams/layers-and-dependency-rule-request.fr.svg)

Le gestionnaire connaît le port `AppointmentRepository`, une classe abstraite du domaine. Il ne
nomme jamais l'adaptateur. Quel adaptateur se tient derrière le port se décide dans la racine de
composition (voir [Ports et composition](ports-and-composition.fr.md)).

## Trois noms, une règle

| | Hexagonale (ports et adaptateurs) | Oignon | *Clean architecture* |
|---|---|---|---|
| Auteur, année | Alistair Cockburn, 2005 | Jeffrey Palermo, 2008 | Robert C. Martin, 2012 (article), 2017 (livre) |
| Idée centrale | l'application ne parle à l'extérieur que par des ports ; les adaptateurs y branchent la technologie | des anneaux concentriques ; le couplage va vers le centre, le modèle du domaine | des anneaux concentriques ; la règle de dépendance : les dépendances du code source ne pointent que vers l'intérieur |
| L'intérieur | « l'application », non subdivisée | modèle du domaine, services du domaine, services d'application | entités, cas d'usage |
| L'extérieur | les adaptateurs, répartis entre pilotants (primaires) et pilotés (secondaires) | infrastructure, interface utilisateur, tests | adaptateurs d'interface, puis *frameworks* et pilotes |
| Ce qu'elle nomme bien | le port, l'adaptateur, la symétrie entre le côté interface et le côté base de données | que le modèle du domaine est le centre et l'infrastructure un anneau extérieur | le cas d'usage comme élément de premier rang, et la règle elle-même |
| Ce qu'elle laisse ouvert | comment l'intérieur s'organise | comment on entre depuis l'extérieur | combien d'anneaux : le livre dit que quatre n'est qu'un exemple |

Ce qu'elles partagent : le code métier est au centre et possède les abstractions dont il a
besoin ; la technologie est en bordure et les implémente ; les imports vont de la bordure vers le
centre ; le centre se teste sans la bordure.

Elles diffèrent par l'accent, pas par le fond. L'hexagonale dessine deux côtés (qui pilote
l'application, ce que l'application pilote) et ne dit rien de l'intérieur. L'oignon et la *clean
architecture* dessinent des anneaux et partagent l'intérieur entre un modèle et des cas d'usage.
La *clean architecture* ajoute un anneau d'« adaptateurs d'interface » (contrôleurs, présentateurs,
*gateways*) entre les cas d'usage et les *frameworks*, là où l'hexagonale n'a que des adaptateurs.

### Comment le kit les fait correspondre

| Dans ce kit | Hexagonale | Oignon | *Clean architecture* |
|---|---|---|---|
| `domain/` | dans l'hexagone | modèle du domaine et services du domaine | entités |
| `application/` | dans l'hexagone | services d'application | cas d'usage |
| `domain/repositories/`, `application/ports/` | ports pilotés | interfaces des anneaux intérieurs | frontières de sortie (output boundaries), interfaces de *gateways* |
| `CommandBus`, `QueryBus`, commandes et requêtes | ports pilotants | API des services d'application | frontières d'entrée (input boundaries) |
| `presentation/` | adaptateurs pilotants | interface utilisateur | contrôleurs (adaptateurs d'interface) |
| `infrastructure/` | adaptateurs pilotés | infrastructure | implémentations de *gateways*, *frameworks* et pilotes |
| `<context>.declarations.ts` et les déclarations de ses couches (ou `<context>.module.ts` dans le style explicite), `platform/composition/compose-application.ts`, `main.ts` | configurateur | résolution des dépendances | composant principal (main component) |

Le kit garde séparés les deux côtés de la bordure (`presentation/` et `infrastructure/`) et leur
interdit de s'importer l'un l'autre. C'est la symétrie hexagonale rendue vérifiable : une route ne
peut pas atteindre directement un adaptateur de *repository*, elle passe par un cas d'usage.

## Pourquoi le domaine ne peut presque rien importer

`layer/domain-purity` est la règle la plus stricte du kit : pas de *framework*, pas d'ORM, pas de
bibliothèque de validation, pas d'entrées-sorties. Les règles `purity/*` l'étendent au temps, au
hasard et à l'environnement, qui atteignent les couches intérieures par les ports `Clock` et
`IdGenerator`. La raison est pratique :

- le modèle se teste en quelques millisecondes sans aucun double (voir
  [Stratégie de test](testing-strategy.fr.md)) ;
- une règle du métier se lit sans connaître de bibliothèque ;
- la mise à jour d'une bibliothèque ne touche jamais une règle métier.

La couche application a droit à un peu plus (les langages publiés des amonts déclarés, les types
de permission), et toujours ni pilote ni *framework*.

## Qui vérifie

Trois analyseurs partagent les identifiants de règle, chacun exact à un niveau différent. La table
« Qui vérifie quoi » de [ARCHITECTURE.md](../ARCHITECTURE.fr.md), section 3, fait référence ; en
bref :

| Analyseur | Ce qu'il voit des couches |
|---|---|
| `ddd-ts-kit check` | les chemins d'import comme du texte, classés par chemin ; assez rapide pour tourner à chaque écriture de fichier |
| le *plugin* ESLint | l'arbre syntaxique d'un fichier ; il fait autorité pour les règles de code quand les deux divergent |
| dependency-cruiser | le graphe des imports résolu : un type qui atteint une couche par un *barrel* ou une réexportation |

`npx ddd-ts-kit explain layer/domain-purity` affiche la règle, sa raison, et un bon et un mauvais
exemple. La comparaison des outils :
[Analyse statique et pipeline](../tools/static-analysis-and-pipeline.fr.md).

## Limites et quand ne pas l'utiliser

- **Elle coûte de l'indirection.** Un port, un adaptateur, un *mapper* et un *fake* pour chaque
  dépendance extérieure. Le générateur les écrit, mais ce sont des fichiers qu'il faut lire. Pour
  un script, un prototype jeté le mois prochain ou un écran CRUD sans règle, un script de
  transaction (transaction script, Fowler, PoEAA) est plus court et honnête.
- **Des couches ne font pas un modèle.** Quatre dossiers autour d'un modèle anémique donnent le
  coût sans le bénéfice : voir [Modèle anémique](anemic-model.fr.md).
- **La conversion est un vrai travail.** Les lignes ne quittent jamais
  `infrastructure/persistence/` et les agrégats ne sortent jamais par une route : chaque frontière
  a donc une conversion à écrire et à tenir à jour.
- **Le *checker* a des angles morts**, listés dans le README de la CLI sous « Limits » : le
  *checker* au niveau du texte ne résout pas les *barrels* ni les réexportations, et rien ne
  contraint ce qu'importent le noyau partagé, la plateforme et `main.ts`. dependency-cruiser
  couvre le premier point ; le second relève de la revue.
- **Les couches sont propres à chaque contexte.** Elles ne disent rien de la façon dont les
  contextes dépendent les uns des autres : c'est le rôle de la carte des contextes et des règles
  `context/*` (voir [Carte des contextes](context-map.fr.md) et
  [Monolithe modulaire](modular-monolith.fr.md)).

## Sources

- Alistair Cockburn, « Hexagonal architecture », 2005, https://alistair.cockburn.us/hexagonal-architecture/
- Jeffrey Palermo, « The Onion Architecture: part 1 », 2008,
  https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- Robert C. Martin, « The Clean Architecture », 2012,
  https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Robert C. Martin, Clean Architecture, Prentice Hall, 2017, chapitre 22 (« The Clean
  Architecture ») et chapitre 11 (le principe d'inversion des dépendances).
- Martin Fowler, Patterns of Enterprise Application Architecture, Addison-Wesley, 2002
  (Transaction Script, Domain Model, Service Layer).
- Eric Evans, Domain-Driven Design, Addison-Wesley, 2003, chapitre 4 (« Isolating the Domain »).

## Voir aussi

- [Ports et composition](ports-and-composition.fr.md)
- [CQRS tel qu'utilisé ici](cqrs.fr.md)
- [Monolithe modulaire](modular-monolith.fr.md)
- [Modèle anémique](anemic-model.fr.md)
- [Stratégie de test](testing-strategy.fr.md)
- [Analyse statique et pipeline](../tools/static-analysis-and-pipeline.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
