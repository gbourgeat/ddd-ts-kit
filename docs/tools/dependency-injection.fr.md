[English](dependency-injection.md) · **Français**
<!-- translation-of: dependency-injection.md sha256:28b4eb9e7f3c96fa -->

# Injection de dépendances : tsyringe avec déclarations, NestJS, câblage manuel

**Résumé.** La Clean Architecture n'attend qu'une chose de l'injection de dépendances : un
endroit unique, la racine de composition, où les adaptateurs sont liés aux ports. Ce kit offre
trois façons d'écrire cet endroit. Avec tsyringe et `@ddd-ts-kit/di`, les classes déclarent ce
qu'elles sont et le contexte est assemblé à partir des déclarations, les erreurs de câblage étant
trouvées avant que quoi que ce soit ne soit instancié. Avec NestJS, le conteneur du framework
fait le travail et les contextes sont câblés explicitement. Avec le câblage manuel, une fonction
construit les objets à la main. Les trois gardent `domain/` et `application/` libres de tout
conteneur ; ils diffèrent par ce qui est vérifié pour vous et par ce que le kit peut générer.

## Ce qui se décide

Quel que soit l'outil, les règles sont les mêmes (`composition/only-in-module`, `layer/*`,
`ports/*` dans [ARCHITECTURE.md](../ARCHITECTURE.fr.md) et la page
[ports et composition](../concepts/ports-and-composition.fr.md)) : un port est une classe
abstraite, un cas d'usage reçoit ses ports par son constructeur, et seule la racine de
composition sait quel adaptateur se tient derrière quel port.

![Le gestionnaire de l'application dépend de deux ports ; un adaptateur de l'infrastructure implémente chaque port ; la racine de composition, écrite dans l'un des trois styles, est le seul endroit qui lie chaque adaptateur à son port](../assets/diagrams/dependency-injection-composition-root.fr.svg)

Le gestionnaire (handler) de l'exemple fil rouge réserve un rendez-vous. Il nomme ce dont il a
besoin par port, dans son constructeur, et rien d'autre :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, type Actor, type Clock, type IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

// contexts/appointments/domain/aggregates/appointment.aggregate.ts, réduit à ce qu'utilise l'exemple
declare class Appointment {
  static book(props: { id: string; clientId: string; startsAt: Date; bookedAt: Date }): Appointment;
  readonly id: string;
}

// contexts/appointments/domain/repositories/appointment.repository.ts : un port est une classe abstraite
export abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}

// contexts/appointments/application/authorization/appointments.permissions.ts
export const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment' },
});

// contexts/appointments/application/commands/book-appointment/book-appointment.command.ts
@Requires(appointmentsPermissions['appointment.book'])
export class BookAppointment extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly startsAt: Date,
  ) {
    super(actor);
  }
}

// contexts/appointments/application/commands/book-appointment/book-appointment.handler.ts
@CommandHandler(BookAppointment)
export class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BookAppointment): Promise<string> {
    const appointment = Appointment.book({
      id: this.ids.next(),
      clientId: command.actor.id,
      startsAt: command.startsAt,
      bookedAt: this.clock.now(),
    });

    await this.appointments.save(appointment);

    return appointment.id;
  }
}
```

Le décorateur vient de `@ddd-ts-kit/kernel/declarations`. Ce n'est que de la métadonnée : il
n'instancie rien et n'importe aucun conteneur. Ce dont dépend le gestionnaire est dit une seule
fois, par son constructeur : `ddd-ts-kit docs` lit la signature dans le source et écrit, dans le
fichier généré du contexte, la liste que le conteneur injecte
([ports et composition](../concepts/ports-and-composition.fr.md), « Comment le constructeur
atteint la racine de composition », compare cela à une liste dans le décorateur et à
`emitDecoratorMetadata`, qui ne tient que dans trois des dix combinaisons de compilateur et
d'exécuteur mesurées). La même classe de gestionnaire, sans le décorateur, est ce que NestJS ou
le câblage manuel lieraient.

Ce que les règles refusent, c'est un cas d'usage qui va chercher lui-même ses dépendances. Au
lieu d'atteindre le conteneur, ou de construire l'adaptateur, dans la couche application :

```ts
// application/commands/book-appointment/book-appointment.handler.ts : refusé
// layer/application-inward : un package de conteneur et un fichier d'infrastructure, importés par l'application
import { container } from 'tsyringe';
import { KnexAppointmentRepository } from '@/contexts/appointments/infrastructure/persistence/knex-appointment.repository';

export class BookAppointmentHandler {
  // composition/only-in-module : l'adaptateur est choisi ici, une fois pour toutes, et un test ne peut pas le remplacer
  private readonly appointments = new KnexAppointmentRepository();
  // une dépendance cachée : le constructeur ne dit plus ce dont le gestionnaire a besoin
  private readonly clock = container.resolve(Clock);

  async execute(command: BookAppointment): Promise<string> { /* ... */ }
}
```

écrivez le constructeur ci-dessus : le gestionnaire reçoit ses ports, un test lui donne des
*fakes*, et le choix de l'adaptateur reste dans la racine de composition.

## Le même contexte, trois racines de composition

Les trois styles lient les mêmes classes. Seul change l'endroit où la liaison est écrite.

**Déclaré (tsyringe et `@ddd-ts-kit/di`).** Chaque classe porte sa déclaration ; le contexte
est assemblé à partir des classes elles-mêmes. `ddd-ts-kit docs` écrit, dans le fichier généré
du contexte, la liste que reçoit chaque constructeur, et `contextModule` transforme les
déclarations en liaisons :

<!-- checked sample -->
```ts
import { AuthorizedCommand, Clock, IdGenerator, type Actor } from '@ddd-ts-kit/kernel';
import { CommandHandler, Repository, injected } from '@ddd-ts-kit/kernel/declarations';
import { contextModule, createApplication, kernelModule } from '@ddd-ts-kit/di';

// les classes du premier exemple, réduites à leur forme
declare class Appointment {
  readonly id: string;
}
abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, startsAt: Date);
}

@CommandHandler(BookAppointment)
class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BookAppointment): Promise<string> {
    // le corps du premier exemple
    return `${this.ids.next()} booked at ${this.clock.now().toISOString()} for ${command.actor.id}`;
  }
}

// contexts/appointments/infrastructure/persistence/in-memory-appointment.repository.ts
@Repository(AppointmentRepository)
class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly saved: Appointment[] = [];

  async save(appointment: Appointment): Promise<void> {
    this.saved.push(appointment);
  }
}

// contexts/appointments/application/application.declarations.ts, généré : jamais écrit à la main
injected(BookAppointmentHandler, [AppointmentRepository, Clock, IdGenerator]);

// main.ts
export async function main(): Promise<void> {
  const appointments = contextModule('appointments', { BookAppointmentHandler, InMemoryAppointmentRepository });
  const app = createApplication({ modules: [kernelModule(), appointments] });

  await app.start();
}
```

Dans un projet, la racine de composition importe le *barrel* généré entier au lieu de nommer
les classes : `contextModule('appointments', appointments)` après
`import * as appointments from '@/contexts/appointments/appointments.declarations'`. Ce fichier
ne fait que réexporter les déclarations générées de chaque couche du contexte, où se
trouvent les instructions `injected`, un fichier par couche
(`application/application.declarations.ts`).

**Explicite (tsyringe et `@ddd-ts-kit/di`).** Chaque liaison est une instruction de
`<context>.module.ts`, avec la liste de ce que prend chaque constructeur. Aucun décorateur n'est
nécessaire :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, Clock, IdGenerator, type Actor } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';

// les classes du premier exemple, sans leurs décorateurs
declare class Appointment {
  readonly id: string;
}
abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, startsAt: Date);
}
declare class BookAppointmentHandler {
  constructor(appointments: AppointmentRepository, clock: Clock, ids: IdGenerator);
  execute(command: BookAppointment): Promise<string>;
}
abstract class Database {
  abstract readonly url: string;
}
declare class KnexAppointmentRepository implements AppointmentRepository {
  constructor(database: Database);
  save(appointment: Appointment): Promise<void>;
}
const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment' },
});

// contexts/appointments/appointments.module.ts
export const appointmentsModule = defineContextModule({
  name: 'appointments',
  register(builder) {
    builder.bind(Database).toValue({ url: 'postgres://localhost/appointments' });
    builder.bind(AppointmentRepository).toClass(KnexAppointmentRepository, [Database]);
    builder
      .command(BookAppointment)
      .requires(appointmentsPermissions['appointment.book'])
      .handledBy(BookAppointmentHandler, [AppointmentRepository, Clock, IdGenerator]);
  },
});

// main.ts
export const app = createApplication({ modules: [kernelModule(), appointmentsModule] });
```

Le compilateur tient chaque liste à son constructeur : `[Clock, AppointmentRepository, IdGenerator]`
(un autre ordre) ou `[AppointmentRepository, Clock]` (un élément de moins) ne compile pas.

**Manuel (`--di manual`, et les contextes de `--di nest`).** Une fonction de la plateforme
construit les objets avec `new` et inscrit chaque gestionnaire sur le bus ; le générateur écrit
les inscriptions entre des marqueurs de `<context>.module.ts` :

<!-- checked sample -->
```ts
import { definePermissions, requires, type UseCaseDeclaration } from '@ddd-ts-kit/auth';
import { AuthorizedCommand, type Actor, type Clock, type IdGenerator, type InMemoryCommandBus } from '@ddd-ts-kit/kernel';

// les classes du premier exemple, sans leurs décorateurs
declare class Appointment {
  readonly id: string;
}
interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
}
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, startsAt: Date);
}
declare class BookAppointmentHandler {
  constructor(appointments: AppointmentRepository, clock: Clock, ids: IdGenerator);
  execute(command: BookAppointment): Promise<string>;
}
declare class KnexAppointmentRepository implements AppointmentRepository {
  constructor(databaseUrl: string);
  save(appointment: Appointment): Promise<void>;
}
const appointmentsPermissions = definePermissions('appointments', {
  'appointment.book': { description: 'Book an appointment' },
});

// platform/composition/platform.ts, réduit : ce que reçoit chaque contexte
interface Platform {
  readonly commands: InMemoryCommandBus;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly databaseUrl: string;
}

// contexts/appointments/appointments.module.ts
export function appointmentsModule(platform: Platform): { name: string; useCases: readonly UseCaseDeclaration[] } {
  const appointments = new KnexAppointmentRepository(platform.databaseUrl);

  // ddd-ts-kit:registrations
  platform.commands.register(BookAppointment, new BookAppointmentHandler(appointments, platform.clock, platform.ids), {
    context: 'appointments',
  });
  // /ddd-ts-kit:registrations

  return {
    name: 'appointments',
    useCases: [requires(BookAppointment, appointmentsPermissions['appointment.book'])],
  };
}
```

Ici le compilateur vérifie les arguments de chaque `new`, et rien d'autre. Un cas d'usage absent
de `useCases` est trouvé par `ddd-ts-kit check` (`authz/declared` lit le fichier du module) ; un
gestionnaire jamais inscrit est trouvé par la première commande qui n'atteint aucun
gestionnaire, pas au démarrage.

**Dans un test**, un module de `@ddd-ts-kit/di` (déclaré ou explicite) s'exécute tel quel, avec
un *fake* lié sous la classe du port, une horloge figée et des identifiants séquentiels :

<!-- checked sample -->
```ts
import { anActor } from '@ddd-ts-kit/auth/testing';
import { AuthorizedCommand, Clock, IdGenerator, type Actor, type CommandHandler } from '@ddd-ts-kit/kernel';
import { createTestApplication, defineContextModule, fake } from '@ddd-ts-kit/di';
import { expect, it } from 'vitest';

// le port, la commande et le gestionnaire du premier exemple, en quelques lignes
type Appointment = { readonly id: string; readonly bookedAt: Date };
abstract class AppointmentRepository {
  abstract save(appointment: Appointment): Promise<void>;
}
class BookAppointment extends AuthorizedCommand<string> {}
class BookAppointmentHandler implements CommandHandler<BookAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(): Promise<string> {
    const appointment = { id: this.ids.next(), bookedAt: this.clock.now() };
    await this.appointments.save(appointment);

    return appointment.id;
  }
}
const appointmentsModule = defineContextModule({
  name: 'appointments',
  register(builder) {
    builder.command(BookAppointment).public().handledBy(BookAppointmentHandler, [AppointmentRepository, Clock, IdGenerator]);
  },
});

// contexts/appointments/test/fakes/in-memory-appointment.repository.ts : un fake implémente le port
class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly saved: Appointment[] = [];

  async save(appointment: Appointment): Promise<void> {
    this.saved.push(appointment);
  }
}

// contexts/appointments/test/unit/book-appointment.handler.spec.ts
it('books the appointment at the instant of the clock, under a new id', async () => {
  const appointments = new InMemoryAppointmentRepository();
  const app = createTestApplication({
    modules: [appointmentsModule],
    fakes: [fake(AppointmentRepository, appointments)],
    now: new Date('2026-03-02T08:00:00.000Z'),
  });
  const client: Actor = anActor().named('ada').build();

  const id = await app.commandBus.execute(new BookAppointment(client));

  expect(id).toBe('id-1');
  expect(appointments.saved).toEqual([{ id: 'id-1', bookedAt: new Date('2026-03-02T08:00:00.000Z') }]);
});
```

`fake(AppointmentRepository, appointments)` ne compile pas quand il manque à `appointments` une
méthode du port. Le câblage manuel n'a pas de conteneur où lier un *fake* : ses *specs*
construisent le gestionnaire avec `new` et l'inscrivent sur `createTestBuses()` de
`@ddd-ts-kit/testing`.

Quand plusieurs *specs* d'un contexte construisent la même application, ou les mêmes bus, avec
les mêmes *fakes*, `npx ddd-ts-kit generate test-world <context>` écrit cette mise en place une
fois, dans `test/worlds/` : voir [Mondes](../concepts/testing-strategy.fr.md#mondes).

## Comparaison

| | tsyringe + `@ddd-ts-kit/di` | Conteneur de NestJS | Câblage manuel |
|---|---|---|---|
| Qui assemble un contexte | le kit, à partir des déclarations (*barrel* généré ou découverte) ou d'un module explicite | tel que généré, la même fonction `<context>Module(platform)` que le câblage manuel ; des *providers* Nest par fabrique quand vous liez vous-même dans des modules Nest | une fonction `<context>Module(platform)` dans `<context>.module.ts` : de simples appels de constructeurs, des inscriptions entre marqueurs |
| Style disponible (`stack.style`) | `declared` ou `explicit`, combinables | `explicit` seulement | `explicit` seulement |
| Jeton d'injection | la classe du port elle-même | les jetons de Nest ; les ports liés dans le module | aucun : de simples variables |
| Ce qu'une classe reçoit | ce que prend son constructeur, chaque paramètre typé par un port : lu dans le source vers un fichier généré, jamais obtenu par réflexion | ce que passe la fabrique du *provider*, ou les `design:paramtypes` et `@Inject` propres à Nest quand vous déclarez les *providers* par classe | les arguments de `new Handler(a, b)` |
| Décorateurs dans vos classes | des déclarations dans `application/` et `infrastructure/`, aucune dans `domain/` ; aucun décorateur de paramètre, aucune réflexion | `@Injectable()` tenu hors de `domain/` et `application/` par une règle ; *providers* déclarés par fabrique | aucun |
| Mode des décorateurs | standard ou legacy | legacy | non concerné |
| Erreurs trouvées avant le démarrage | liaison en double, dépendance non liée, cycle, gestionnaire, consommateur ou *job* en double, autorisation non déclarée, et d'autres (`WiringError` avec un code) | les erreurs de résolution propres à Nest, à l'amorçage | le compilateur, pour les constructeurs ; rien pour un gestionnaire oublié |
| Point d'accroche transverse | `instrumentation` de `kernelModule` (traçage, de l'extérieur), `around(kinds, ...)` dans un module pour chaque liaison d'une sorte, `.with(...)` ou les `aspects` d'une déclaration pour une liaison | appeler les enveloppes dans la fabrique du *provider* | appeler les enveloppes à la main |
| Application de test | `createTestApplication` avec `fake(Port, instance)` | module de test de Nest, ou `createTestBuses` | `createTestBuses` |
| Dépendances d'exécution en plus | `tsyringe`, `reflect-metadata` | les *packages* de Nest | aucune |

## Les bibliothèques sous-jacentes, vérifiées le 2026-10-10

- **tsyringe** (Microsoft, MIT) : dernière version npm 4.10.0, publiée le 2025-04-16 ; environ
  14 millions de téléchargements par semaine. Le dépôt n'est pas archivé, mais ses derniers
  *commits* fonctionnels datent d'avril 2025 (le seul *commit* ultérieur, en septembre 2026,
  épingle des actions de CI), sa dernière étiquette de version publiée (release) sur GitHub est
  v4.4.0, de 2020, et 82 tickets sont ouverts. En clair : très utilisé, stable, en maintenance
  peu active. Il refuse de se charger sans `reflect-metadata` (0.2.2, mars 2024).
- **À quel point le kit en dépend.** `@ddd-ts-kit/di` utilise un conteneur enfant de tsyringe
  comme registre : les ports sont inscrits sous une identité de symbole, les dépendances sont
  nommées dans des listes et jamais obtenues par réflexion, aucun décorateur de tsyringe
  n'apparaît dans votre code, et `reflect-metadata` n'est importé par le *package* que parce que
  tsyringe l'exige. La surface exposée à l'avenir de tsyringe est donc petite, et les
  vérifications du câblage sont celles du kit. C'est malgré tout une dépendance envers un projet
  calme : une équipe pour qui c'est inacceptable a les deux autres options, au coût indiqué
  plus bas.
- **NestJS** (MIT) : `@nestjs/core` 12.1.2, publié le 2026-09-30, environ 16 millions de
  téléchargements par semaine, Node 20 ou plus récent, publié activement.
- **Alternatives non prises en charge par le kit**, pour le contexte seulement : InversifyJS
  8.2.3 et Awilix 13.0.5 sont tous deux maintenus (versions publiées en 2026). Aucun n'a
  d'adaptateur ici ; en utiliser un revient, du point de vue du kit, à la sémantique de
  `stack.di: manual`.

## Critères de choix

1. **Voulez-vous le style déclaré ?** Un décorateur par classe, aucun fichier de module, aucune
   liste de dépendances : un *barrel* généré, qui inscrit aussi ce que prend chaque
   constructeur, tenu à jour par le générateur (`declarations/barrel-current`). Seul tsyringe
   le donne, et c'est son défaut : la CLI refuse `--style declared` avec `--di manual` et
   `--di nest`, dont le défaut est `explicit`. `--di nest` va avec `--http nest`, et
   réciproquement.
2. **NestJS est-il déjà le framework ?** Son conteneur est alors là de toute façon
   ([frameworks HTTP](http-frameworks.fr.md)).
3. **Combien de vérifications au démarrage voulez-vous ?** Les vérifications de
   `createApplication` (une commande avec deux gestionnaires, deux consommateurs qui partagent un
   nom, un cas d'usage qui ne déclare aucune permission) sont ce à quoi renonce le câblage
   manuel.
4. **Empaquetage (bundling) et démarrage à froid.** Un *barrel* avec `contextModule` est
   statique et suivi par un *bundler* ; la découverte lit des répertoires au démarrage et ne peut
   pas être empaquetée.
5. **Budget de dépendances.** Le câblage manuel n'ajoute rien.

## Ce que ce kit prend en charge et a vérifié

D'après [`packages/di/README.md`](../../packages/di/README.fr.md),
[`packages/kernel/README.md`](../../packages/kernel/README.fr.md) et
[`packages/cli/README.md`](../../packages/cli/README.fr.md) :

- **Une injection par constructeur qui tient quel que soit le compilateur** : les deux modes de
  décorateurs, `tsc` 6 et 7, `tsx`, Vitest et Jest avec swc, parce que rien n'est demandé au
  compilateur à l'exécution.
- **Des vérifications à la compilation**, dans les deux modes de décorateurs : une liste de
  dépendances, générée ou écrite, qui ne correspond pas au constructeur, une classe qui
  n'implémente pas le port dont elle est déclarée l'adaptateur, une classe concrète nommée là où
  un port est attendu.
- **Des vérifications au chargement** (`DeclarationError`) : un port qui a un corps, un
  adaptateur qui étend son port, deux déclarations sur une même classe.
- **Des vérifications au démarrage** (`WiringError`) : liaisons en double ou absentes, cycles
  entre liaisons de classes, gestionnaires, consommateurs et *jobs* en double, `rebind` de rien,
  une classe déclarée dont le constructeur prend des paramètres et qu'aucune liste ne couvre, ou
  une liste d'une autre longueur ; avec `authorization: 'required'`, un cas d'usage qui ne
  déclare ni une permission ni qu'il est public, et des déclarations qu'aucun module n'applique.
- **`kernelModule()`** lie une implémentation par défaut qui fonctionne pour chaque port du
  kernel (bus en mémoire, unité de travail, cache, verrou, limiteur de débit, *logger* et
  métriques sans effet), chacune remplaçable par option ou par `rebind`.
- **Deux assemblages** d'un contexte déclaré (`stack.assembly`) : `barrel` (le défaut) et
  `discovery`, avec ou sans *broker*. `--assembly` est refusé avec `--style explicit`.
- **Prouvé de bout en bout par la CLI** (`proven-stacks.spec.ts`, tel que son README les
  énumère) : des projets générés dans le style déclaré (la *stack* par défaut ; avec ReBAC et
  RabbitMQ ; avec knex et la découverte, seule et derrière NATS), dans le style explicite sur
  tsyringe (la *stack* par défaut ; avec ReBAC et RabbitMQ), et avec `--di manual` (avec ABAC et
  knex ; avec Fastify, knex, RabbitMQ et Redis). Aucun projet NestJS généré ne figure dans cette
  liste : les *stacks* NestJS sont générées et tenues à `check` et à la vérification des types,
  pas installées ni exécutées.
- **Application de test** avec horloge fixe, identifiants séquentiels, bus en mémoire et *fakes*
  liés sous la classe du port.

Les vérifications ci-dessus attrapent chaque erreur au plus tôt, à l'un de quatre moments ;
seule une dépendance résolue dans une fabrique attend le premier message qui construit la
classe :

![Quatre moments du style déclaré, du source à une application en marche : le compilateur vérifie les listes de dépendances et les implémentations des ports, l'import des classes vérifie les déclarations, createApplication vérifie les liaisons et l'autorisation, et le premier message construit le gestionnaire](../assets/diagrams/dependency-injection-when-mistakes-are-found.fr.svg)

## Limites, et quand ne pas l'utiliser

Énoncées par le *package* :

- Une classe joue un rôle : une déclaration par classe. Un adaptateur qui implémente deux ports
  est lié explicitement, une fois par port.
- Une déclaration ne s'hérite pas : une sous-classe se déclare elle-même ou est liée
  explicitement.
- Les noms (consommateur, politique, *job*, événement du domaine) sont écrits dans la
  déclaration, jamais déduits du nom de la classe.
- Un port à vous est identifié par sa classe : chargé depuis deux copies d'un *package*, il fait
  deux jetons, sauf s'il déclare une `tokenKey`. Une application compilée comme un seul
  programme ne rencontre jamais ce cas.
- Les fabriques ne déclarent pas ce qu'elles résolvent : un cycle ou un port absent qui passe
  par une fabrique est signalé quand il est résolu, pas au démarrage.
- La découverte importe des fichiers que rien d'autre n'importe : il faut le dire à knip et à
  dependency-cruiser, elle s'exécute séquentiellement au démarrage, et un *bundler* ne peut pas
  la suivre.
- Un décorateur de classe d'une autre bibliothèque qui remplace la classe doit se placer sous la
  déclaration du kit.

Des alternatives :

- **NestJS** : style explicite seulement ; les routes du kit contournent le *pipeline* de
  requêtes HTTP de Nest ; le mode legacy des décorateurs s'applique à tout le programme ; les
  vérifications au démarrage ci-dessus sont remplacées par celles de Nest.
- **Manuel** : aucune vérification que chaque gestionnaire est inscrit ou chaque cas d'usage
  protégé, au-delà de ce que `ddd-ts-kit check` lit dans le texte (`authz/declared`,
  `events/consumer-idempotent`) ; les enveloppes transverses sont appliquées à la main, si bien
  qu'un appel oublié fait un adaptateur non tracé.

N'introduisez aucun conteneur dans un script, une migration ou un contexte de trois classes
exécuté seul : construire les objets à la main, c'est cela la racine de composition.

## Recommandation selon la situation

![Un arbre de décision : NestJS déjà en place comme framework mène à son conteneur ; une politique contre les dépendances peu actives ou un très petit service mène au câblage manuel ; sinon tsyringe dans le style déclaré, assemblé depuis un barrel quand l'application passe par un bundler, et avec un module explicite pour un contexte au câblage inhabituel](../assets/diagrams/dependency-injection-choosing.fr.svg)

| Situation | Choix |
|---|---|
| Nouveau projet sur Express ou Fastify | tsyringe dans le style déclaré avec un *barrel* : le défaut, le plus généré, le plus vérifié |
| Câblage inhabituel dans un contexte (fabriques, liaisons conditionnelles) | le même, avec un module explicite pour ce contexte, ou `include` dans un module mixte |
| Déploiement serverless ou empaqueté | tsyringe, `contextModule` avec le *barrel* ; évitez la découverte |
| Application NestJS existante | conteneur de NestJS, style explicite, *providers* par fabrique |
| Une politique contre les dépendances peu actives, ou un très petit service | câblage manuel, en sachant à quelles vérifications au démarrage on renonce |

## Sources

- tsyringe : https://github.com/microsoft/tsyringe (*commits*, versions publiées et tickets lus
  le 2026-10-10) ; entrée `tsyringe` du registre npm.
- Documentation de NestJS, *providers* personnalisés : https://docs.nestjs.com/fundamentals/custom-providers
- InversifyJS : https://inversify.io ; Awilix : https://github.com/jeffijoe/awilix
- Notes de version de TypeScript 5.0, décorateurs :
  https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html
- Robert C. Martin, Clean Architecture, Prentice Hall, 2017, chapitre 26 (« The Main
  Component »).
- Mark Seemann, « Composition Root » (2011) : https://blog.ploeh.dk/2011/07/28/CompositionRoot/
- Martin Fowler, « Inversion of Control Containers and the Dependency Injection pattern »
  (2004) : https://martinfowler.com/articles/injection.html

## Voir aussi

- [Ports et composition](../concepts/ports-and-composition.fr.md)
- [Les couches et la règle de dépendance](../concepts/layers-and-dependency-rule.fr.md)
- [Frameworks HTTP](http-frameworks.fr.md)
- [Stratégie de test](../concepts/testing-strategy.fr.md)
- [L'analyse statique et le *pipeline*](static-analysis-and-pipeline.fr.md)
- [Configuration](../CONFIG.fr.md)
