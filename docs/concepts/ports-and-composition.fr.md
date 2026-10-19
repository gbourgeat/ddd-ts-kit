[English](ports-and-composition.md) · **Français**
<!-- translation-of: ports-and-composition.md sha256:3c5b0871f260cdac -->

# Ports et composition

**Résumé.** Un port est ce dont les couches internes ont besoin de l'extérieur, dit dans leurs
propres mots. Dans ce kit, un port est une classe abstraite aux seuls membres abstraits, et cette
classe est aussi le jeton d'injection : un seul nom porte le type à la compilation et l'identité
à l'exécution. Les adaptateurs implémentent les ports et ne les étendent jamais. Les objets sont
assemblés en un seul endroit, la racine de composition, soit à partir de ce que les classes
déclarent d'elles-mêmes par des décorateurs (le style déclaré), soit à partir de liaisons écrites
à la main dans un fichier de module (le style explicite). Dans le style déclaré, une classe dit
une seule fois ce dont elle dépend, dans la signature de son constructeur, et le kit le lit dans
le source. Cette page explique les choix, ce que coûte chaque style et où sont les limites.

## Un port, dans l'application scheduling

`scheduling` doit stocker des rendez-vous, et il affiche le nom d'un patient, que connaît
`identity`. Aucun de ces deux besoins ne dit quoi que ce soit de HTTP ou de SQL :

<!-- checked sample -->
```ts
import { AggregateRoot, Repository } from '@ddd-ts-kit/kernel';

declare class Appointment extends AggregateRoot {}

// contexts/scheduling/domain/repositories/appointment.repository.ts
export abstract class AppointmentRepository extends Repository<Appointment> {
  /** Les rendez-vous actifs d'un calendrier qui occupent un instant entre `from` et `until`. */
  abstract heldOn(calendarId: string, from: Date, until: Date): Promise<readonly Appointment[]>;
}

// contexts/scheduling/application/ports/person-directory-gateway.port.ts
/** Ce que scheduling demande à identity sur les personnes : le nom à afficher pour un patient, et rien d'autre. */
export abstract class PersonDirectoryGateway {
  abstract namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>>;
}
```

Un port est nommé d'après ce dont l'application a besoin, pas d'après la technologie qui est
derrière. Un port de *repository* vit dans `domain/repositories/`, tout autre port dans
`application/ports/`, un par fichier ([ARCHITECTURE.fr.md](../ARCHITECTURE.fr.md) section 4,
« Ports » et « Ports et adaptateurs »).

![Un gestionnaire dépend du port PersonDirectoryGateway, qui est à la fois le type du paramètre de son constructeur et le jeton sur lequel s'appuie le conteneur ; l'adaptateur et le fake implémentent le port, et la racine de composition le lie à l'un des deux](../assets/diagrams/ports-and-composition-port-and-adapters.fr.svg)

## Pourquoi une classe abstraite, et pas une interface

Une interface TypeScript est effacée par le compilateur : rien d'elle n'existe à l'exécution. Un
conteneur qui doit répondre à « donne-moi l'`AppointmentRepository` » a besoin d'une valeur
d'exécution sur laquelle s'appuyer, si bien que les projets bâtis sur des interfaces en ajoutent
une à la main : une chaîne, un symbole ou une constante, rangée dans un fichier de jetons et
tenue en phase avec l'interface par discipline.

Une classe abstraite est les deux à la fois :

| Besoin | Une interface plus un jeton | Une classe abstraite |
|---|---|---|
| un type pour le paramètre du constructeur | l'interface | la classe |
| une identité d'exécution à lier et à résoudre | une constante, à un second endroit | la classe elle-même |
| un `resolve` typé | un générique sur le jeton, déclaré à la main | découle de la classe |
| un paramètre de constructeur qui nomme ce qui est injecté | impossible : le type est effacé, un jeton doit être répété à côté | le type du paramètre est le jeton |
| un renommage | deux noms à renommer | un seul |

Au lieu d'une interface et d'un jeton tenus en phase à la main :

```ts
export interface PersonDirectoryGateway {
  namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>>;
}

export const PERSON_DIRECTORY_GATEWAY = Symbol('PersonDirectoryGateway'); // ports/no-token-constant

constructor(@Inject(PERSON_DIRECTORY_GATEWAY) private readonly directory: PersonDirectoryGateway) {}
```

écrivez la classe abstraite de la section précédente, et nommez-la une seule fois :

```ts
constructor(private readonly directory: PersonDirectoryGateway) {}
```

Ainsi, le gestionnaire ci-dessous nomme ses dépendances une seule fois, comme les ports qui
typent les paramètres de son constructeur, et nulle part ailleurs :

<!-- checked sample -->
```ts
// contexts/scheduling/application/commands/book-appointment/book-appointment.handler.ts (simplifié)
import { AggregateRoot, Clock, Command, IdGenerator, Repository } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

declare class Appointment extends AggregateRoot {}
declare class Calendar extends AggregateRoot {}

export abstract class AppointmentRepository extends Repository<Appointment> {}
export abstract class CalendarRepository extends Repository<Calendar> {}

export class BookAppointmentCommand extends Command<string> {
  constructor(readonly calendarId: string) {
    super();
  }
}

@CommandHandler(BookAppointmentCommand)
export class BookAppointmentHandler implements CommandHandler<BookAppointmentCommand> {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly calendarRepository: CalendarRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: BookAppointmentCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(command.calendarId);
    // ... réserve un créneau du calendrier à this.clock.now(), l'enregistre avec this.appointmentRepository

    return calendar === undefined ? '' : this.ids.next();
  }
}
```

Il n'y a ni décorateur de paramètre, ni `reflect-metadata` pour les décorateurs du kit, ni
`emitDecoratorMetadata` : la signature est lue dans le source par `ddd-ts-kit docs`, qui écrit ce
qu'il a lu dans le fichier généré du contexte. La section suivante dit pourquoi.

## Comment le constructeur atteint la racine de composition

Un conteneur a besoin, à l'exécution, de la liste des jetons que prend un constructeur. Trois
mécanismes peuvent la lui donner, et ils ont été mesurés sur les compilateurs et les exécuteurs
qu'un projet du kit rencontre (TypeScript 6.0.3 et le TypeScript natif 7.0.2, tsx 4, Vitest 5
avec et sans le *plugin* de décorateurs de `@ddd-ts-kit/testing`, swc 1.16 tel que Jest
l'exécute ; une classe décorée dont le constructeur prend deux ports, lue avec
`Reflect.getMetadata('design:paramtypes', ..)`) :

| Compilateur ou exécuteur | Décorateurs historiques avec `emitDecoratorMetadata` | Décorateurs standard (TC39) |
|---|---|---|
| `tsc` 6, `tsc` 7 (le build) | les deux classes | aucune métadonnée |
| `tsx` (le script `dev`, esbuild) | aucune métadonnée | aucune métadonnée |
| Vitest 5, transformation propre | les deux classes | n'analyse pas le fichier |
| Vitest 5 avec le *plugin* du kit | les deux classes | aucune métadonnée |
| swc (Jest) avec `decoratorMetadata` | les deux classes | aucune métadonnée |
| n'importe lequel, le port importé avec `import type` | `Object`, `Object` (ou `Function`) : le type est effacé | aucune métadonnée |

| | Une liste dans le décorateur | Les métadonnées du compilateur | Une liste générée |
|---|---|---|---|
| Ce qu'écrit le développeur | le constructeur, puis les mêmes ports une seconde fois dans `@CommandHandler(M, [..])` | le constructeur | le constructeur |
| Fonctionne avec les décorateurs standard | oui | non : la proposition n'émet aucun type de paramètre | oui |
| Fonctionne sous `tsx`, esbuild | oui | non | oui |
| Survit à `import type` et à `verbatimModuleSyntax` | non : la liste a besoin de la valeur (`ports/value-import`) | non : enregistré comme `Object` | oui : le fichier généré importe la valeur |
| Peut être en désaccord avec le constructeur | le compilateur refuse une discordance, la répétition demeure | non | non : dérivée ; un fichier périmé est refusé par une porte et au démarrage |
| A besoin d'une étape de génération | non | non | oui : `ddd-ts-kit docs`, chaque `generate`, chaque démarrage de `dev` |

Les métadonnées du compilateur sont le seul mécanisme qui n'exige ni répétition ni fichier
généré, et elles tiennent dans trois cases sur dix : elles feraient démarrer une application
dans son build et ses tests et échouer sous `npm run dev`, ou fonctionner pour un projet sur
class-validator et pas pour un projet sur zod. Le kit lit donc les signatures lui-même,
statiquement, et les écrit :

```ts
// contexts/scheduling/scheduling.declarations.ts, généré : jamais modifié (un extrait)
import { injected } from '@ddd-ts-kit/kernel/declarations';
import { BookAppointmentHandler } from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.handler';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';

export * from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.command';
export * from '@/contexts/scheduling/application/commands/book-appointment/book-appointment.handler';

injected(BookAppointmentHandler, [AppointmentRepository, CalendarRepository, IdGenerator, Clock]);
```

`injected` est typé comme l'était la liste d'un décorateur : le compilateur refuse une liste qui
ne correspond pas au constructeur, si bien qu'un fichier généré est vérifié par le compilateur
avec le reste. Quatre choses l'empêchent de se périmer en silence :

- **Une porte.** `ddd-ts-kit check` (`declarations/barrel-current`) et `ddd-ts-kit docs --check`
  comparent le fichier avec ce que disent les sources et nomment la classe dont le constructeur a
  changé ; `verify` et les deux *pipelines* les exécutent.
- **Le développement.** `npm run dev` charge `ddd-ts-kit/dist/refresh-declarations.js` avant
  l'application à chaque démarrage et à chaque rechargement par l'observateur de fichiers :
  ajoutez un port à un constructeur, enregistrez, et le processus qui redémarre le reçoit.
- **Le démarrage.** Une classe qui prend des paramètres et n'a pas de liste, ou une liste d'une
  autre longueur, arrête `createApplication` par une `WiringError` (`MISSING_DEPENDENCIES`,
  `DEPENDENCY_ARITY`) qui nomme la classe et la commande à lancer. Rien n'est jamais injecté
  comme `undefined`.
- **Une règle.** `declarations/constructor-injection` refuse un paramètre qui ne nomme pas une
  seule classe : une union, une interface, un type primitif, un paramètre facultatif ou avec une
  valeur par défaut.

![De la signature d'un constructeur à une instance : ddd-ts-kit docs lit le constructeur, écrit injected(Handler, [ports]) dans le fichier de déclarations généré, createApplication vérifie le graphe et construit ; une règle, le script dev, une porte et le démarrage gardent la liste générée en phase avec le constructeur](../assets/diagrams/ports-and-composition-constructor-to-instance.fr.svg)

Ce qu'une signature peut dire, et ce qu'elle ne peut pas dire :

| Paramètre | |
|---|---|
| typé par un port, un port du kernel (`Clock`, `CommandBus`, `Logger`...), une autre classe déclarée | son jeton |
| propriétés de paramètre `private readonly`, `protected`, `public`, un décorateur de paramètre d'une autre bibliothèque | ignorés, la lecture passe au travers |
| typé par une classe générique, `Cache<Session>` | la classe brute `Cache` est le jeton : les arguments de type ne disent rien de ce qui est lié |
| un type primitif, une valeur, un objet de réglages | pas un jeton : typez le paramètre par une classe abstraite aux membres en lecture seule et liez-la à la valeur dans le module de la plateforme |
| une interface, un alias de type, une union, une intersection | refusé, avec la même réponse : une classe abstraite |
| facultatif (`?`), une valeur par défaut, un paramètre du reste (rest), déstructuré | refusé : le conteneur donne toujours une valeur à chaque paramètre |
| pas de constructeur, et pas de classe de base | zéro dépendance, rien n'est généré pour la classe |
| un constructeur hérité d'une classe du projet | lu dans la classe de base, en suivant ses imports |
| un constructeur hérité d'une classe d'un *package* | refusé : écrivez le constructeur dans la classe |

Il n'y a délibérément pas de `@Inject(Token)` sur un paramètre. Les décorateurs de paramètre
n'existent pas parmi les décorateurs standard, si bien qu'une telle échappatoire ne fonctionnerait
que dans un seul mode de décorateurs ; un décorateur de propriété sortirait une dépendance du
constructeur, qui est le seul endroit que lit le kit. L'échappatoire pour un paramètre dont le
type n'est pas un jeton est celle que le kit avait déjà pour les valeurs : une classe abstraite,
liée dans la plateforme. Une liste écrite dans le décorateur,
`@CommandHandler(BookAppointmentCommand, [AppointmentRepository, CalendarRepository, IdGenerator, Clock])`,
est la forme qu'écrivaient les projets de la 0.1. Elle est toujours lue, vérifiée par le
compilateur contre le constructeur, et elle l'emporte sur la signature ; un projet la garde avec
`"stack.dependencies": "listed"` (ce que signifie une config sans la clé) et la quitte avec
`"signature"`, où ESLint retire chaque liste qui répète son constructeur.

### La règle des ports

Un port n'a que des membres abstraits : pas de corps, pas de paramètre de constructeur, pas de
membre privé ou protégé. Un adaptateur `implements` son port et ne l'`extends` jamais. La raison
est que les types de TypeScript sont structurels : tant que le port ne porte aucun comportement,
un *fake*, une classe en mémoire ou un simple littéral d'objet lui correspond sans cérémonie, et
rien du port ne peut fuir dans un adaptateur par héritage. Une valeur qui n'est pas un port (des
réglages, une connexion à une base de données) passe de la même façon, par une classe abstraite
aux membres en lecture seule liée à un objet simple.

Les règles sont `ports/abstract-class`, `ports/implements-never-extends`,
`ports/no-token-constant`, `ports/no-concrete-dependency` (un paramètre de constructeur est typé
par un port, jamais par un adaptateur ou un *fake*) et `ports/value-import` (un port nommé dans
une liste de dépendances ou donné à `bind` est importé comme valeur : la classe est le jeton ; un
port qui ne fait que typer un paramètre de constructeur peut être importé avec `import type`).
Le kernel refuse aussi, au chargement du fichier, un port qui a un corps ou un adaptateur qui
étend son port.

### La limite de l'identité

Une classe est sa propre identité. Si un processus charge deux copies du *package* qui définit un
port (une installation dupliquée, un bundle à côté de `node_modules`), il détient deux classes,
donc deux jetons, et ce qui est lié sous l'un n'est pas trouvé sous l'autre. Le README du kernel
énonce la limite et la réponse : un port susceptible d'être chargé depuis deux copies déclare une
clé statique, qui est alors son identité dans chaque copie ; les ports injectables du kernel en
portent une. Un port d'une application compilée une seule fois en un seul programme n'en a jamais
besoin.

## Adaptateurs

<!-- checked sample -->
```ts
// contexts/scheduling/infrastructure/external/in-process-person-directory.gateway.ts
import { Gateway } from '@ddd-ts-kit/kernel/declarations';

// le langage publié de identity : le contrat que scheduling peut appeler dans le processus
export abstract class PersonDirectoryContract {
  abstract byIds(personIds: readonly string[]): Promise<readonly { readonly personId: string; readonly displayName: string }[]>;
}

export abstract class PersonDirectoryGateway {
  abstract namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>>;
}

@Gateway(PersonDirectoryGateway)
export class InProcessPersonDirectoryGateway implements PersonDirectoryGateway {
  constructor(readonly upstream: PersonDirectoryContract) {}

  async namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>> {
    const cards = await this.upstream.byIds(personIds);

    return new Map(cards.map((card) => [card.personId, { displayName: card.displayName }]));
  }
}
```

Quand `identity` s'exécute comme un service à part entière, cette classe devient un client HTTP
ou RPC derrière le même port : la déclaration reste, et rien d'autre ne change dans `scheduling`.

Un adaptateur dit quel port il implémente et quel rôle il joue (`@Repository`, `@Gateway`,
`@Adapter`). C'est le rôle qui permet d'attacher de l'extérieur un comportement transverse : le
traçage enveloppe chaque liaison qui a un genre, une politique de nouvelles tentatives vise les
*gateways* et les adaptateurs externes (voir [Résilience](resilience.fr.md) et
[Observabilité](observability.fr.md)). Chaque port a un *fake* dans `test/fakes/`, tenu par la
même suite de contrat que l'adaptateur réel ([Stratégie de test](testing-strategy.fr.md)).

## La racine de composition

Il faut bien que quelque chose connaisse chaque couche pour les relier. Le kit confine ce savoir :
les adaptateurs ne sont instanciés ou liés, et les classes déclarées assemblées, que dans le
fichier de module d'un contexte (style explicite), dans `main.ts` et dans le répertoire de la
plateforme (`composition/only-in-module`). `main.ts` importe d'abord le traçage, charge la
configuration, ouvre le stockage et appelle `composeApplication` de
`src/platform/composition/compose-application.ts`, qui liste les modules : le module du kernel (bus par
défaut, horloge, générateur d'identifiants, implémentations en mémoire par défaut), le module de
la plateforme (stockage, fournisseur d'événements, politique autour des adaptateurs sortants), les
modules d'autorisation et d'audit, le module des fichiers quand le projet stocke des fichiers, et
un module par contexte, construit à partir de ses déclarations. Le conteneur vérifie tout le
graphe avant d'instancier quoi que ce soit : liaisons en double, dépendances non liées et cycles
sont des erreurs au démarrage, qui nomment le port et le module (la liste des vérifications est
dans le README de `@ddd-ts-kit/di`).

![La racine de composition de l'application d'exemple : main.ts appelle composeApplication, qui remet à createApplication les modules du kernel, de la plateforme, de l'autorisation et de l'audit et des fichiers, et un module par contexte, identity, scheduling, notification et analytics ; le conteneur vérifie tout le graphe avant de construire quoi que ce soit](../assets/diagrams/ports-and-composition-composition-root.fr.svg)

Dans le style explicite, une composition entière tient en quelques lignes. Le même port reçoit
l'adaptateur dans l'application et un *fake* dans un test, et le gestionnaire ne change pas :

<!-- checked sample -->
```ts
import { Query, QueryBus, type QueryHandler } from '@ddd-ts-kit/kernel';
import { createApplication, createTestApplication, defineContextModule, fake, kernelModule } from '@ddd-ts-kit/di';

export abstract class PersonDirectoryContract {
  abstract byIds(personIds: readonly string[]): Promise<readonly { readonly personId: string; readonly displayName: string }[]>;
}

export abstract class PersonDirectoryGateway {
  abstract namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>>;
}

export class InProcessPersonDirectoryGateway implements PersonDirectoryGateway {
  constructor(private readonly upstream: PersonDirectoryContract) {}

  async namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>> {
    const cards = await this.upstream.byIds(personIds);

    return new Map(cards.map((card) => [card.personId, { displayName: card.displayName }]));
  }
}

// test/fakes/person-directory-gateway.fake.ts : la même forme, répond ce que le test lui a donné
export class FakePersonDirectoryGateway implements PersonDirectoryGateway {
  constructor(private readonly names: Readonly<Record<string, string>>) {}

  async namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>> {
    return new Map(personIds.flatMap((id) => (id in this.names ? [[id, { displayName: this.names[id] ?? '' }] as const] : [])));
  }
}

export class GetPatientName extends Query<string | undefined> {
  constructor(readonly patientId: string) {
    super();
  }
}

export class GetPatientNameHandler implements QueryHandler<GetPatientName> {
  constructor(private readonly directory: PersonDirectoryGateway) {}

  async execute(query: GetPatientName): Promise<string | undefined> {
    const names = await this.directory.namesOf([query.patientId]);

    return names.get(query.patientId)?.displayName;
  }
}

export const schedulingModule = defineContextModule({
  name: 'scheduling',
  register(builder) {
    builder.bind(PersonDirectoryGateway).toClass(InProcessPersonDirectoryGateway, [PersonDirectoryContract]).as('gateway');
    builder.query(GetPatientName).handledBy(GetPatientNameHandler, [PersonDirectoryGateway]);
  },
});

export const identityModule = defineContextModule({
  name: 'identity',
  register(builder) {
    builder.bind(PersonDirectoryContract).toValue({
      byIds: async (ids) => ids.map((personId) => ({ personId, displayName: 'Ada Lovelace' })),
    });
  },
});

// l'application : le port reçoit l'adaptateur
const app = createApplication({ modules: [kernelModule(), identityModule, schedulingModule] });
await app.resolve(QueryBus).execute(new GetPatientName('patient-1')); // 'Ada Lovelace'

// un test : le même port reçoit le fake
const test = createTestApplication({
  modules: [identityModule, schedulingModule],
  fakes: [fake(PersonDirectoryGateway, new FakePersonDirectoryGateway({ 'patient-1': 'Ada' }))],
});
await test.get(QueryBus).execute(new GetPatientName('patient-1')); // 'Ada'
```

Le test liste toujours `identityModule` : un *fake* remplace une liaison, et le conteneur vérifie
toujours chaque liaison qu'un module déclare. Sans lui, `createTestApplication` s'arrête sur
`WiringError: "PersonDirectoryGateway" in module "scheduling" depends on "PersonDirectoryContract",
which no module binds.` (`UNBOUND_DEPENDENCY`).

## Deux façons de dire à la racine ce qui existe

| | Style déclaré | Style explicite |
|---|---|---|
| Où une liaison est écrite | sur la classe, comme décorateur du point d'entrée des déclarations du kernel | dans `<context>.module.ts`, une instruction par liaison |
| Fichier d'enregistrement par contexte | aucun à la main : un *barrel* généré, ou la découverte | le fichier de module |
| Ce que reçoit une classe | ce que prend son constructeur, lu dans le source et écrit dans le fichier généré | la liste de `.toClass(Adapter, [Ports])` et de `.handledBy(Handler, [Ports])` : l'explicite reste explicite |
| Ajouter un cas d'usage | ajouter les fichiers ; le *barrel* est régénéré | ajouter les fichiers et une instruction |
| Ajouter une dépendance | ajouter le paramètre du constructeur | ajouter le paramètre, et le port à la liste de l'instruction |
| Lire le câblage d'un contexte | réparti dans les classes ; `ddd-ts-kit describe <context>` le rassemble | un seul fichier |
| Valeurs, fabriques, liaisons conditionnelles | inexprimables par un décorateur : écrites dans un module | natif |
| Conteneurs | seul `@ddd-ts-kit/di` (sur tsyringe) transforme les déclarations en liaisons | tsyringe, providers NestJS ou câblage manuel |
| Domaine | ne porte aucun décorateur, dans un style comme dans l'autre | idem |

Le style déclaré est celui par défaut avec tsyringe ; le style explicite reste disponible, et les
deux se mélangent dans une même application et même dans un même module. Les déclarations sont
des métadonnées : un décorateur n'instancie rien et n'importe aucun conteneur, c'est pourquoi la
couche application peut les porter. Le domaine ne déclare rien (`declarations/role-declared`).

### Barrel ou découverte

Un contexte déclaré atteint la racine de l'une de deux façons (`stack.assembly` dans
[CONFIG.fr.md](../CONFIG.fr.md)) :

| | *Barrel* généré | Découverte |
|---|---|---|
| Mécanisme | un fichier généré qui réexporte chaque fichier de rôle | un parcours des dossiers du contexte au démarrage |
| Où sont les listes des constructeurs | dans le *barrel*, après les exports | dans un `<context>.dependencies.ts` généré, que le parcours charge avec les fichiers de rôle ; jamais les métadonnées du compilateur |
| Analyse statique | les bundlers, knip et dependency-cruiser le suivent | les fichiers chargés ne sont importés par rien : il faut dire aux analyseurs que ce sont des points d'entrée |
| Démarrage | rien à lire | lit des répertoires et importe séquentiellement |
| Empaqueté (bundle) ou serverless | convient | un bundler ne peut pas le suivre |
| Un fichier écrit à la main | doit être dans le *barrel* : `declarations/barrel-current` signale un *barrel* périmé | pris en compte tout seul ; son constructeur doit tout de même être dans le fichier des dépendances, ce que tient la même règle |
| Sous Vitest | rien à configurer | `@ddd-ts-kit/di` doit être intégré (`server.deps.inline`), ce que fait la config générée |

### Ce qu'un décorateur ne peut pas exprimer

- une valeur ou une fabrique (un objet de configuration, un client construit à partir de
  réglages) ;
- un adaptateur qui implémente deux ports (une déclaration par classe : liez-le explicitement,
  une fois par port) ;
- une liaison qui dépend de la configuration ;
- l'héritage : une déclaration n'est pas héritée par une sous-classe ;
- ce que reçoit une classe quand son constructeur prend quelque chose qui n'est pas une classe :
  voir le tableau ci-dessus.

Pour ces cas, un module explicite inclut les classes déclarées et ajoute les instructions.

### Les deux modes de décorateurs

TypeScript a deux implémentations des décorateurs, et un programme en utilise une. Un projet lié
au mode historique par class-validator, NestJS ou des entités TypeORM pose
`experimentalDecorators` ; tout autre projet utilise les décorateurs standard sans option. Les
décorateurs du kit servent les deux avec la même ligne de source. Une conséquence pratique est
documentée dans le *package* de test : Vitest transforme lui-même les décorateurs historiques, et
a besoin d'un *plugin* du kit pour les décorateurs standard.

## Limites, et quand ne pas l'utiliser

- **Le câblage déclaré est implicite.** Personne ne lit un seul fichier pour voir comment un
  contexte est assemblé. Le *barrel* généré, `ddd-ts-kit describe` et les vérifications du
  démarrage compensent ; une équipe qui veut le câblage dans un seul fichier relu choisit le style
  explicite.
- **L'injection par le constructeur a besoin d'un fichier généré.** Ce que prend un constructeur
  atteint le conteneur par un fichier qu'écrit `ddd-ts-kit docs`. Il est commité, régénéré par
  `dev` et comparé par une porte, mais une classe modifiée en dehors de ces chemins (un script
  qui ne lance jamais `docs`, un fichier chargé par rien de ce que lit le générateur) est refusée
  au démarrage plutôt qu'injectée. Nest et le câblage manuel ne sont pas concernés : Nest injecte
  par ses propres métadonnées et providers, le câblage manuel appelle `new Handler(a, b)`.
- **Un test assemble un contexte à partir de son fichier généré**, comme le fait la racine de
  composition : `contextModule('ordering', orderingDeclarations)`, ou une classe qui en est
  tirée, `contextModule('ordering', { PlaceOrderHandler: orderingDeclarations.PlaceOrderHandler })`.
  Une classe importée depuis son propre fichier et remise seule à `contextModule` n'a pas de
  liste.
- **Les ports coûtent des fichiers.** Un port, un adaptateur et un *fake* pour une dépendance qui
  n'aura jamais qu'une implémentation, c'est un surcoût. Le kit l'accepte pour tout ce qui sort
  du processus, parce que le *fake* est ce qui garde rapides les tests des gestionnaires ;
  n'ajoutez pas de ports entre des classes d'une même couche.
- **Les fabriques cachent leurs dépendances.** Un cycle ou un port manquant qui passe par une
  fabrique est signalé à la résolution, pas au démarrage.
- **Les décorateurs demandent du soin avec les autres bibliothèques** : un décorateur de classe
  d'une autre bibliothèque qui remplace la classe doit être écrit sous la déclaration (README de
  di, « Limits »).

## Sources

- Alistair Cockburn, « Hexagonal architecture », 2005, https://alistair.cockburn.us/hexagonal-architecture/
- Mark Seemann, « Composition Root », 2011, https://blog.ploeh.dk/2011/07/28/CompositionRoot/
- Martin Fowler, « Inversion of Control Containers and the Dependency Injection pattern », 2004,
  https://martinfowler.com/articles/injection.html
- Robert C. Martin, Clean Architecture, Prentice Hall, 2017, chapitre 11 (inversion des
  dépendances) et chapitre 26 (« The Main Component »).
- Manuel de TypeScript, « Decorators » (historiques) et notes de version de TypeScript 5.0
  (décorateurs standard), https://www.typescriptlang.org/docs/handbook/decorators.html
- README de [`@ddd-ts-kit/kernel`](../../packages/kernel/README.fr.md) et de
  [`@ddd-ts-kit/di`](../../packages/di/README.fr.md).

## Voir aussi

- [Couches et règle de dépendance](layers-and-dependency-rule.fr.md)
- [CQRS tel qu'il est utilisé ici](cqrs.fr.md)
- [Stratégie de test](testing-strategy.fr.md)
- [Résilience](resilience.fr.md)
- [Injection de dépendances : comparaison des outils](../tools/dependency-injection.fr.md)
- [Référence d'architecture](../ARCHITECTURE.fr.md)
- [Configuration](../CONFIG.fr.md)
