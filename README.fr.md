[English](README.md) · **Français**
<!-- translation-of: README.md sha256:a8bf732e6ef21db7 -->

# ddd-ts-kit

Domain-Driven Design (DDD), Clean Architecture (hexagonale, ports et adaptateurs) et Clean Code
pour les backends TypeScript et Node.js, tenus par des outils plutôt que par de bonnes
intentions, pour les développeurs et pour les agents de code avec lesquels ils travaillent :
Claude Code, Codex et GitHub Copilot.

**La documentation est aussi un site web**, avec une recherche, en français et en anglais :
<https://gbourgeat.github.io/ddd-ts-kit/fr/>.

C'est trois choses qui partagent une seule définition de l'architecture
([docs/ARCHITECTURE.fr.md](docs/ARCHITECTURE.fr.md)) :

- un **plugin pour Claude Code, Codex et GitHub Copilot** : des skills, des agents et des hooks
  qui font travailler un agent de code à l'intérieur de l'architecture, générer au lieu de taper du code répétitif, et
  s'arrêter quand une règle est enfreinte ;
- une **CLI** : démarrer un projet en quelques minutes, générer chaque brique à partir de
  templates, vérifier la structure, générer la documentation ;
- des **packages d'exécution et des analyseurs** : des briques indépendantes de tout framework,
  un plugin ESLint et un pipeline de CI pour GitHub et GitLab.

TypeScript seulement. Aucun framework imposé : Express, Fastify, Hono ou NestJS ; zod,
class-validator, TypeBox ou toute bibliothèque Standard Schema ; tsyringe, NestJS ou un câblage
manuel ; Drizzle, Knex, Prisma ou TypeORM ; RabbitMQ, Kafka, NATS JetStream ou Redis Streams ;
JWT ou Keycloak ; rôles, attributs ou relations. `ddd-ts-kit init` sans option prend Express,
zod, tsyringe, Drizzle sur PostgreSQL et Vitest.

La documentation est aussi écrite en français : chaque page a sa traduction à côté d'elle, à
laquelle mène le lien de sa première ligne, à partir de cette page et de
[l'index en français de la documentation](docs/README.fr.md).

## Démarrer un projet

Suivez ces étapes dans l'ordre : c'est le chemin pris en charge, et les outils sont faits pour
le tenir. Chaque étape est une skill du plugin (`/ddd-ts-kit:<skill>`), ou une commande, et
laisse un fichier que la suivante lit. `/ddd-ts-kit:start` conduit les étapes 1 à 7 une à une,
les consigne dans `docs/architecture/plan.md`, et `npx ddd-ts-kit status` dit à tout moment
quelle étape vient ensuite.

| # | Étape | Skill ou commande | Produit |
|---|---|---|---|
| 1 | Découvrir le domaine | `discover-domain` | `docs/architecture/discovery.md` : acteurs, commandes, événements, politiques |
| 2 | Trouver les contextes délimités | `bounded-contexts` | `docs/architecture/contexts.md` : chaque frontière et sa raison |
| 3 | Écrire les glossaires | `glossary` | le langage omniprésent de chaque contexte |
| 4 | Dessiner la carte des contextes | `context-map` | qui est en amont de qui, et par quel patron |
| 5 | Choisir la stack et démarrer le projet | `bootstrap`, `ddd-ts-kit init`, `generate context` | le projet, vert sur `verify`, un `CONTEXT.md` par contexte |
| 6 | Planifier les tranches | `plan-slices` | `docs/architecture/slices.md` : un cas d'usage par tranche, dans l'ordre |
| 7 | Construire tranche par tranche | `use-case` (`parallel-work` pour plusieurs workers) | le code et ses tests, un commit par tranche |
| 8 | Passer la porte de qualité | `quality-gate`, `npm run verify` | une porte verte avant chaque fusion |
| 9 | Documenter | `document`, `npm run docs:generate` | des contrats à jour, la carte des contextes et les enregistrements de décision |

![Les neuf étapes : quatre écrites dans les mots du métier sous docs/architecture/ (découvrir le domaine, trouver les contextes, écrire les glossaires, dessiner la carte des contextes), puis cinq avec les générateurs (démarrer le projet, planifier les tranches, construire une tranche, passer la porte, documenter) ; les étapes 7 et 8 se répètent pour chaque tranche](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-workflow.fr.svg)

Sauter une étape coûte plus tard, et le coût est connu : sans les étapes 1 à 4, les frontières
sont tracées d'après les tables de la base de données, et chaque renommage traverse les
contextes ; un glossaire écrit après le code décrit le code au lieu du métier, et les
générateurs refusent ses noms tant qu'il n'existe pas ; sans la carte des contextes, la
première intégration est un import direct que le checker refuse ensuite ; sans le plan des
tranches, le travail arrive par couches, et rien n'est démontrable avant la fin. La
[méthodologie](docs/guides/methodology.fr.md) est la référence de chaque étape ;
[quelle commande, quand](docs/guides/commands.fr.md) donne la commande de chaque moment d'un
projet, avec une première fonctionnalité partie de zéro.

## Démarrage rapide

```bash
mkdir orders-api && cd orders-api
npx ddd-ts-kit init
pnpm install
pnpm run verify           # types, lint, format, tests, e2e, architecture, graphe des imports, code mort, dérive de la documentation
```

Sans option, `init` prend la stack par défaut et pnpm, que corepack fournit dans la version
qu'épingle le `package.json` (`corepack enable`, une fois par machine). Le projet est vert dès
ce premier `verify`, avant une ligne de code métier, et le reste à chaque étape. Ensuite, le
langage omniprésent d'abord, le code ensuite :

```bash
pnpm exec ddd-ts-kit generate context ordering --classification core \
  --term "Order=A customer's request to buy products" --term "Place=To submit an order for fulfilment"
pnpm exec ddd-ts-kit generate context billing --classification supporting --upstream ordering:customer-supplier
pnpm exec ddd-ts-kit generate aggregate ordering Order
pnpm exec ddd-ts-kit generate repository ordering Order
pnpm exec ddd-ts-kit generate command ordering PlaceOrder --permission order.place --grant customer --aggregate Order
pnpm exec ddd-ts-kit generate route ordering PlaceOrder --method POST --path /orders
pnpm run docs:generate    # le contrat OpenAPI suit la nouvelle route
pnpm run verify
pnpm exec ddd-ts-kit status   # ce qui reste : TODO(domain), TODO(platform) et it.todo par contexte
```

Ces deux blocs sont exécutés tels qu'ils sont écrits, ligne à ligne, par la suite de bout en
bout de ce dépôt, sur pnpm et sur npm. Avec `npx ddd-ts-kit init --package-manager npm`, les
mêmes lignes deviennent `npm install`, `npm run <script>` et `npx ddd-ts-kit <command>` ; la
note qu'affiche `init` et le README qu'il écrit les disent dans les mots du gestionnaire de
paquets choisi. Pour voir l'application tourner : `cp .env.example .env`, `pnpm run infra:up`
(PostgreSQL, dans Docker), `pnpm run db:generate initial`, `pnpm run db:migrate`, puis
`pnpm run dev` (rechargement automatique ; documentation de l'API sur `/docs`).

Chaque `generate` écrit le fichier, sa spec, son fake ou son builder et son enregistrement, et
liste les endroits `TODO(domain)` où une décision métier est attendue. Un nom absent du
glossaire du contexte est refusé, tout comme une commande ou une requête qui ne déclare ni
permission ni `--public`. `--grant customer` accorde la permission au rôle `customer` dans les
rôles de la plateforme : sans lui, seul le super-administrateur atteint le cas d'usage et
`check` avertit (`authz/granted`). `pnpm exec ddd-ts-kit generate --help` liste les 36 types
de fichiers. Ce qui change d'une version à l'autre : [CHANGELOG.md](CHANGELOG.md).

### Une tranche, de bout en bout

Les lignes `generate` ci-dessus construisent une tranche verticale du contexte `ordering` : la
requête HTTP `POST /orders` traverse les quatre couches. Le contrôleur, le gestionnaire,
l'agrégat `Order` et son repository sont des classes que les générateurs ont écrites ; le bus
de commandes vient de la plateforme qu'a écrite `init`.

![La requête HTTP POST /orders suivie à travers le contrôleur, le bus de commandes, le gestionnaire, l'agrégat Order et le repository Drizzle, dans une seule unité de travail, jusqu'à la réponse 201](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-slice-flow.fr.svg)

1. Le contrôleur (`presentation/http/orders/place-order/place-order.controller.ts`) valide le
   corps avec son schéma, construit `PlaceOrderCommand` avec l'acteur de la requête HTTP et
   l'envoie sur le bus de commandes (1, 2).
2. Le bus de commandes de la plateforme journalise et mesure le cas d'usage, ne le laisse
   passer que si l'acteur détient `order.place`, et ouvre l'unité de travail (3).
3. Le gestionnaire (`application/commands/place-order/place-order.handler.ts`) interroge
   l'agrégat : `Order.place(...)` vérifie ses invariants et enregistre `OrderPlaced`, ou lève un
   refus (4 à 6).
4. Le gestionnaire sauvegarde par le port `OrderRepository` du domaine. L'adaptateur Drizzle
   (`infrastructure/persistence/drizzle-order.repository.ts`), lié à ce port au démarrage de
   l'application, écrit la ligne dans la transaction (7, 8).
5. L'unité de travail remet `OrderPlaced` à ses gestionnaires, toujours dans la transaction,
   puis valide (9). Le contrôleur répond `201` avec l'identifiant (10, 11). Un refus reçoit à
   la place un document d'erreur « problem details » (RFC 9457) qui porte son code stable.

Ce qui vous reste, c'est le métier : les endroits `TODO(domain)`. Une fois remplie, la partie
domaine et application de cette tranche se lit ainsi, en un seul bloc ici, là où les
générateurs écrivent un fichier par classe (le refus vient de
`generate error ordering Order empty`, l'événement de
`generate domain-event ordering Order Placed`) :

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import {
  type Actor,
  AggregateRoot,
  AuthorizedCommand,
  type Clock,
  ConceptError,
  type DomainEvent,
  type IdGenerator,
  Repository,
} from '@ddd-ts-kit/kernel';
import { CommandHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

// application/authorization/ordering.permissions.ts : `generate command` a déclaré la permission
export const orderingPermissions = definePermissions('ordering', {
  'order.place': { description: 'Place order' },
});

// domain/errors/order.error.ts : chaque refus est une fabrique statique avec un code stable
export class OrderError extends ConceptError {
  static empty() {
    return OrderError.refusal('ORDER_EMPTY', 'An order holds at least one product.');
  }
}

// domain/events/order-placed.event.ts : un fait, nommé au passé
export class OrderPlaced implements DomainEvent {
  static readonly eventName = 'ordering.order.placed';

  readonly name = OrderPlaced.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly customerId: string,
  ) {}
}

// domain/aggregates/order.aggregate.ts : les invariants vivent ici, et nulle part ailleurs
export interface OrderState {
  readonly customerId: string;
  readonly productIds: readonly string[];
  readonly placedAt: Date;
}

export class Order extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: OrderState,
  ) {
    super(id);
  }

  // le client et les produits voyagent ensemble : un objet de paramètres, trois paramètres au plus
  static place(id: string, request: Pick<OrderState, 'customerId' | 'productIds'>, now: Date): Order {
    if (request.productIds.length === 0) {
      throw OrderError.empty();
    }

    const order = new Order(id, { ...request, placedAt: now });

    order.record(new OrderPlaced(id, now, request.customerId));

    return order;
  }

  static rehydrate(id: string, state: OrderState): Order {
    return new Order(id, state);
  }

  toState(): OrderState {
    return { ...this.state };
  }
}

// domain/repositories/order.repository.ts : un port, une classe abstraite qui est son propre jeton d'injection
export abstract class OrderRepository extends Repository<Order> {}

// application/commands/place-order/place-order.command.ts : l'acteur d'abord, puis des données simples
@Requires(orderingPermissions['order.place'])
export class PlaceOrderCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
    readonly productIds: readonly string[],
  ) {
    super(actor);
  }
}

// application/commands/place-order/place-order.handler.ts : le temps et les identifiants viennent de ports
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements CommandHandler<PlaceOrderCommand> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({ customerId, productIds }: PlaceOrderCommand): Promise<string> {
    const order = Order.place(this.ids.next(), { customerId, productIds }, this.clock.now());

    await this.orderRepository.save(order);

    return order.id;
  }
}
```

Le gestionnaire n'ouvre jamais de transaction, ne vérifie jamais la permission et ne publie
jamais l'événement : le bus de commandes et le repository le font, autour de lui. Sa spec
l'exécute dans l'application de test avec les fakes de ses ports ;
[Quelle commande, quand](docs/guides/commands.fr.md#une-première-fonctionnalité-à-partir-de-zéro)
suit cette première fonctionnalité jusqu'au bout, et l'[application d'exemple](examples/scheduling/README.fr.md)
montre un produit entier construit de cette façon.

## Le plugin : Claude Code, Codex, GitHub Copilot

Ce dépôt est la marketplace du plugin pour les trois agents :

| Agent | Installation | Une skill s'appelle |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, puis `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, puis installer `ddd-ts-kit` depuis `/plugins` et approuver ses hooks dans `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, puis `copilot plugin install ddd-ts-kit@ddd-ts-kit` | par son nom, `start` |
| Agent cloud de Copilot, VS Code | déclaré par le `.github/copilot/settings.json` qu'écrit `init` : l'agent cloud l'installe, VS Code le recommande | par son nom, `start` |

Vingt-deux skills, dans l'ordre où un projet les rencontre :

| Skill | Usage |
|---|---|
| `start` | conduire un projet d'une expression des besoins jusqu'à des contextes qui fonctionnent (lancée par l'utilisateur) |
| `discover-domain` | un event storming léger, par écrit |
| `bounded-contexts` | trouver les contextes et les classer cœur, de soutien ou génériques |
| `glossary` | le langage omniprésent d'un contexte et son `CONTEXT.md`, avant tout code |
| `context-map` | amont, aval et patron de relation pour chaque paire de contextes |
| `bootstrap` | choisir la stack et créer le projet (lancée par l'utilisateur) |
| `plan-slices` | le travail en tranches verticales par contexte, ordonnées, avec leurs commandes de génération |
| `parallel-work` | répartir les tranches entre plusieurs agents ou personnes sans collision |
| `scaffold` | un fichier de n'importe quel rôle, à partir d'un template |
| `use-case` | une fonctionnalité de bout en bout, test d'abord |
| `integration-event` | faire collaborer deux contextes par un événement versionné |
| `wiring` | les ports comme classes abstraites, les déclarations, la racine de composition, les fakes dans les tests |
| `persistence` | repositories, unité de travail, outbox, modèles de lecture, migrations, quel que soit l'ORM |
| `access-control` | authentification, permissions par cas d'usage, acteur explicite, politiques |
| `cross-cutting` | journalisation, métriques, traçage, remontée des erreurs, journal d'audit, résilience et cache appliqués de l'extérieur |
| `testing` | des fakes au lieu de mocks, des builders, étant donné / quand / alors, de bout en bout |
| `clean-code` | nommage, ordre des fonctions, commentaires, testabilité |
| `document` | contrat OpenAPI et ses clients typés, catalogue d'événements, AsyncAPI, listes générées, enregistrements de décision |
| `extract-service` | garder chaque contexte prêt à tourner comme son propre service, et l'extraire |
| `deviation` | que faire quand on vous demande de contourner une règle |
| `quality-gate` | lancer les contrôles à la bonne portée et corriger à la cause racine |
| `commit-discipline` | une tranche par commit, les fichiers générés avec ce qui les a générés |

Quatre agents : `domain-explorer` (réponses en lecture seule sur ce qui existe et où),
`context-builder` (construit les tranches d'un contexte dans son propre worktree),
`domain-test-writer` (transforme les entrées `it.todo` en specs) et `architecture-reviewer`
(revue en lecture seule d'un diff, d'une branche ou d'un contexte).

Le hook est la partie qui rend le reste contraignant. Dans un projet qui a un
`ddd-ts-kit.config.json`, il rappelle la démarche et la carte des contextes au début de la
session, signale quand les packages installés ne sont pas la version que décrivent les skills, refuse un fichier écrit à la main là où un générateur existe ainsi que toute
modification d'un contrat généré, demande l'avis du propriétaire du projet avant qu'une
désactivation, un test sauté ou un changement des règles soit écrit, vérifie chaque fichier
écrit et renvoie les violations avec leur correction, et refuse de terminer tant que des
erreurs d'architecture restent. Il rappelle, sans bloquer, quand les changements non commités
dépassent la taille conseillée d'un commit, et dans le worktree d'un worker
(`.ddd-ts-kit/worker.json`), il refuse une écriture hors du contexte du worker. En cas de
panne, il laisse passer : une garde cassée ne bloque jamais le travail. Mettez `"guard": "advise"` dans la
configuration pour être consulté au lieu d'essuyer un refus, `"off"` pour le faire taire.

Chaque agent reçoit ce que son hôte exécute. Les skills fonctionnent dans les trois. Les quatre
agents sont des sous-agents de Claude Code ; Codex ne charge aucun agent depuis un plugin, et une
session par worktree tient le rôle de `context-builder`. Le hook tourne partout où l'hôte exécute
les hooks d'un plugin : il lit les patchs de Codex et les appels d'outils de Copilot aussi bien
que ceux de Claude Code. Codex ne sait pas poser de question à l'utilisateur : ce que Claude Code
soumet au propriétaire du projet y est signalé à l'utilisateur, et laissé aux vérifications du
pipeline.

Même sans plugin, un projet guide chaque agent : `init` écrit `AGENTS.md`, le guide que lisent
Codex, Copilot et la plupart des agents (`CLAUDE.md` l'importe), les règles par couche pour
Claude Code dans `.claude/rules/` et les mêmes règles pour Copilot dans `.github/instructions/`,
ciblées par `applyTo`, et, avec le pipeline GitHub, `copilot-setup-steps.yml`, qui installe le
projet avant le démarrage de l'agent cloud de Copilot. `npm run verify` et le pipeline tiennent
chaque agent aux mêmes règles.

## Ce qui est imposé

Les règles ont un identifiant, une raison et une correction (`npx ddd-ts-kit explain <rule-id>`) :

- **Couches** (`layer/*`) : présentation, application, domaine, infrastructure ; le domaine
  n'importe rien d'autre que lui-même et le kernel.
- **Contextes délimités** (`context/*`, `tree/*`) : une arborescence canonique fermée, un
  `CONTEXT.md` par contexte, des relations déclarées dans une carte des contextes, un autre
  contexte atteint seulement par son langage publié, aucun cycle.
- **Langage omniprésent** (`language/*`) : chaque classe du domaine et chaque cas d'usage est
  nommé avec des termes du glossaire du contexte ; les noms techniques sont refusés dans le
  domaine.
- **Pureté** (`purity/*`) : le temps par `Clock`, les identifiants par `IdGenerator`, aucun
  accès à l'environnement dans le domaine ou l'application.
- **DDD tactique** (`domain/*`, `application/*`, `events/*`, `domain-events/*`) : des agrégats
  encapsulés, des objets-valeurs immuables, des erreurs du domaine spécifiques, un gestionnaire
  par cas d'usage, des événements du domaine distribués à la fin de l'unité de travail (avant
  la validation (commit), ou après elle pour un gestionnaire déclaré comme tel), des événements
  d'intégration déclarés une fois avec un schéma.
- **Ports et câblage** (`ports/*`, `declarations/*`, `composition/*`) : un port est une classe
  abstraite et son propre jeton d'injection, un adaptateur l'implémente, une classe déclare son
  rôle avec un décorateur, dit une seule fois ce dont elle dépend, dans la signature de son
  constructeur (lue dans le code source, jamais dans les métadonnées du compilateur, si bien
  que cela tient dans les deux modes de décorateurs et sous `tsx`), et est assemblée en un seul
  endroit.
- **Clean code** (`clean/*`) : ordre en escalier (stepdown), petites fonctions et petits
  fichiers, un export par fichier, aucun argument drapeau, aucun code commenté, aucun
  commentaire de bruit, aucune échappatoire.
- **Préoccupations transverses** (`aspects/*`, `tracing/*`, `standard/*`, `scheduling/*`) :
  la résilience et le traçage appliqués de l'extérieur, les interfaces standard du kernel, des
  jobs qui ne font que déclencher des cas d'usage.
- **Contrôle d'accès** (`authz/*`) : chaque cas d'usage et chaque route déclare sa permission
  ou dit qu'il est public ; les droits se décident dans la couche application, jamais dans un
  contrôleur, un repository ou le domaine ; l'acteur est explicite.
- **Contextes extractibles** (`context/extractable`, `events/outbox-required`) : des données
  propres, aucune transaction partagée, des événements par l'outbox transactionnelle, des
  consommateurs idempotents, chaque contexte démarrable seul.
- **Dérogations** (`governance/recorded-deviation`) : une désactivation ou une règle assouplie
  porte une raison et un enregistrement de décision. La garde soumet chacune au propriétaire du
  projet.
- **Tests** (`test/*`) : une spec pour chaque unité de comportement, un builder par agrégat,
  aucun mock.
- **Et le reste** : `errors/*`, `naming/*`, `presentation/*`, `persistence/*`, `tenancy/*`,
  `event-sourcing/*`, `imports/*` et quelques autres. `npx ddd-ts-kit rules` liste chaque
  identifiant avec sa sévérité.

### Au lieu de ceci, écrivez cela

Un gestionnaire écrit à la va-vite enfreint quatre règles d'un coup, et chaque constat nomme sa
règle :

```ts
// application/commands/place-order/place-order.handler.ts, écrit à la va-vite
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { PlaceOrderCommand } from '@/contexts/ordering/application/commands/place-order/place-order.command';
import { db, orders } from '@/contexts/ordering/infrastructure/database'; // layer/application-inward

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements CommandHandler<PlaceOrderCommand> {
  async execute({ customerId, productIds }: PlaceOrderCommand): Promise<string> {
    if (productIds.length === 0) {
      throw new Error('Empty order'); // domain/no-generic-error
    }

    const id = crypto.randomUUID(); // purity/no-ambient-randomness

    await db.insert(orders).values({ id, customerId, productIds, placedAt: new Date() }); // purity/no-system-clock

    return id;
  }
}
```

Le gestionnaire du [démarrage rapide](#une-tranche-de-bout-en-bout) est le même cas d'usage,
écrit dans les règles :

| Au lieu de | Écrivez | Règle |
|---|---|---|
| `new Date()` | `this.clock.now()`, le port `Clock` reçu dans le constructeur | `purity/no-system-clock` |
| `crypto.randomUUID()` | `this.ids.next()`, le port `IdGenerator` | `purity/no-ambient-randomness` |
| `throw new Error('Empty order')` | `throw OrderError.empty()`, un refus avec un code stable | `domain/no-generic-error` |
| un import de `infrastructure/` dans un gestionnaire | le port `OrderRepository`, lié à son adaptateur par la plateforme | `layer/application-inward` |
| un import du `domain/` d'un autre contexte | le `published-language/` de ce contexte, ou un événement d'intégration | `context/published-language-only` |

Chaque constat vient avec sa correction, et `npx ddd-ts-kit explain <rule-id>` en donne la
raison.

### Où elles sont vérifiées

![Les mêmes règles vérifiées à trois moments : à chaque écriture de fichier par le hook du plugin Claude Code, avant chaque fusion par npm run verify, et à chaque push par le pipeline de CI, les trois appliquant les règles définies dans docs/ARCHITECTURE.md](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-checks.fr.svg)

Trois analyseurs les tiennent, chacun là où il est exact : le checker de la CLI, sans
dépendance, pour la structure et pour un retour instantané à chaque écriture de fichier, le
plugin ESLint sur l'arbre syntaxique pour les règles de code, dependency-cruiser sur le graphe
des imports résolu. knip et le compilateur TypeScript en mode strict complètent la porte.

## Packages

| Package | Ce qu'il apporte |
|---|---|
| [`ddd-ts-kit`](packages/cli) | la CLI : `init`, `generate`, `check`, `docs`, `sdk` (un client typé du contrat OpenAPI, ses refus typés par leurs codes d'erreur), `list`, `describe`, `status`, `todo`, `worker-scope`, `affected` (ce qu'une pull request doit lancer), `depcruise-config`, `build-aliases`, `rules`, `explain`, et les migrations d'un style à un autre (`error-factories`, `controllers`, `value-objects`) |
| [`@ddd-ts-kit/kernel`](packages/kernel) | entités, agrégats, objets-valeurs, erreurs du domaine, `Result` ; les ports comme classes abstraites ; les déclarations (`@CommandHandler`, `@Repository`, ...) ; bus de commandes, de requêtes et d'événements avec des implémentations en mémoire ; les interfaces standard extensibles : `Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`, `Page`, `Clock`, `IdGenerator`, `UnitOfWork`, `ErrorReporter`, `FileStorage` ; le côté lecture : critères, hydratation et modèles de lecture |
| [`@ddd-ts-kit/events`](packages/events) | déclarations typées des événements d'intégration, registre, outbox transactionnelle et relais, génération d'AsyncAPI et du catalogue d'événements |
| [`@ddd-ts-kit/rabbitmq`](packages/rabbitmq), [`kafka`](packages/kafka), [`nats`](packages/nats), [`redis/event-bus`](packages/redis) | fournisseurs de brokers derrière un seul contrat : publication acquittée pour le relais de l'outbox, un abonnement durable par consommateur, nouvelles tentatives bornées, files de rejet |
| [`@ddd-ts-kit/scheduling`](packages/scheduling) | des jobs lancés par le temps qui ne font que déclencher des cas d'usage : intervalles et cron avec fuseaux horaires, une seule exécution sur l'ensemble des instances, chaque exécution dans sa propre portée d'exécution |
| [`@ddd-ts-kit/auth`](packages/auth) | acteurs, permissions déclarées par cas d'usage, refus par défaut ; autoriseurs par rôles, par attributs et par relations (à la manière de Zanzibar) derrière un seul port ; authentification JWT |
| [`@ddd-ts-kit/openfga`](packages/openfga) | les relations d'`auth` sur un serveur OpenFGA : stockage des tuples et autoriseur, modèle généré à partir du schéma, dérive vérifiée |
| [`@ddd-ts-kit/aspects`](packages/aspects) | journalisation, métriques, nouvelle tentative, délai d'expiration, disjoncteur, cache et cloison appliqués de l'extérieur : enveloppes, middlewares de bus, décorateurs standard |
| [`@ddd-ts-kit/audit`](packages/audit) | journal d'audit chaîné par hachage, en ajout seul, alimenté par les décisions d'autorisation, les commandes et les événements d'intégration |
| [`@ddd-ts-kit/redis`](packages/redis) | cache, verrou, limiteur de débit et signal de relais sur Redis, Dragonfly ou Valkey |
| [`@ddd-ts-kit/s3`](packages/s3) | le port `FileStorage` du kernel sur AWS S3, MinIO, OVHcloud, Scaleway ou Cloudflare R2 : envois en flux, liens signés de courte durée ; jamais le contenu d'un fichier dans la base de données |
| [`@ddd-ts-kit/http`](packages/http) | des routes déclarées une fois, montées sur Express, Fastify, Hono ou NestJS ; erreurs RFC 9457 ; génération d'OpenAPI 3.1 ; Swagger UI, Scalar ou Redoc ; politiques de cache, `ETag`, `If-Match` et étiquettes de cache, avec des purgeurs pour Varnish, Fastly et Cloudflare (`/purgers`) |
| [`@ddd-ts-kit/validation`](packages/validation) | un seul port `Schema` au-dessus de zod, class-validator, TypeBox et Standard Schema ; des schémas partagés par plusieurs routes, documentés une fois |
| [`@ddd-ts-kit/di`](packages/di) | des modules de contexte sur tsyringe, à partir des déclarations d'un contexte ou d'un module explicite, les classes de port comme jetons, une application de test avec des fakes |
| [`@ddd-ts-kit/pino`](packages/pino), [`winston`](packages/winston) | le port `Logger` du kernel sur pino ou winston, avec les champs de corrélation sur chaque ligne |
| [`@ddd-ts-kit/sentry`](packages/sentry) | le port `ErrorReporter` du kernel sur Sentry ou GlitchTip : les échecs inattendus seulement, expurgés |
| [`@ddd-ts-kit/tracing`](packages/tracing) | OpenTelemetry câblé une fois par la plateforme : le domaine ne l'importe jamais, les spans ne portent jamais de données |
| [`@ddd-ts-kit/testing`](packages/testing) | builders, scénarios étant donné / quand / alors, repository en mémoire, suites de contrat, données générées à partir d'une graine, harnais de bout en bout |
| [`@ddd-ts-kit/drizzle`](packages/drizzle), [`knex`](packages/knex), [`prisma`](packages/prisma), [`typeorm`](packages/typeorm) | unité de travail avec une transaction ambiante, stockage de l'outbox, stockage des événements traités, stockages de modèles de lecture (les projections SQL du côté lecture) ; isolation des tenants sur Knex (tables partagées, sécurité au niveau des lignes, schéma ou base de données par tenant) et Drizzle (les deux premières) ; le magasin d'événements PostgreSQL des agrégats en event sourcing |
| [`@ddd-ts-kit/eslint-plugin`](packages/eslint-plugin) | les règles de code sur l'arbre syntaxique, avec des préréglages |

Tout passe par des ports du kernel, si bien que chaque pièce est remplaçable : un autre
fournisseur d'événements, un autre ORM ou un autre framework HTTP est un adaptateur qui passe
la même suite de contrat.

![Où chaque package est importé : dans un contexte délimité, le domaine n'importe que le kernel, l'application y ajoute auth, la présentation importe http et validation, l'infrastructure un package d'ORM, le langage publié events et validation ; la plateforme compose les contextes avec di et les packages de ses capacités techniques](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-packages.fr.svg)

Le domaine d'un contexte dépend du seul kernel, qui n'a lui-même aucune dépendance : le code
métier compile et exécute ses tests sans framework HTTP, sans base de données et sans broker.
Les packages qui parlent au monde extérieur sont importés par l'infrastructure et par la
plateforme, qui lie chaque adaptateur à son port au démarrage de l'application.

## Pipeline

`init --ci github|gitlab|both` installe les mêmes portes sur l'une ou l'autre plateforme, à
partir des mêmes scripts npm : vérification des types, lint, architecture, code mort, tests
unitaires avec seuils de couverture, tests d'intégration sur PostgreSQL, tests de bout en bout,
dérive de la documentation et du contrat, sécurité (npm audit et gitleaks), construction de
l'image, et une seule porte finale à marquer comme obligatoire. Chaque outil est gratuit sur
n'importe quel dépôt ; CodeQL, la revue des dépendances et les scanners de GitLab, qui
demandent un forfait payant sur un dépôt privé, sont optionnels (`--ci-extras`). Les détails
et la table d'équivalence entre GitHub et GitLab : [pipeline/README.md](pipeline/README.md).

## Documentation

Commencez par l'[index de la documentation](docs/README.fr.md) : il liste chaque page et
propose un ordre de lecture à qui découvre le DDD, à un tech lead qui adopte le kit et à un
contributeur.

- **Référence (normative).** [Référence de l'architecture](docs/ARCHITECTURE.fr.md) :
  l'arborescence canonique, les identifiants de règle, les conventions tactiques et de clean
  code, les niveaux de test. [Configuration](docs/CONFIG.fr.md) : `ddd-ts-kit.config.json`.
  Chaque package a son propre README, avec ses limites et ce qui a été vérifié.
- **[Concepts](docs/concepts/README.fr.md).** Une page par idée, en parcours de lecture :
  conception stratégique, conception tactique, architecture, messagerie, préoccupations
  transverses, clean code et tests.
- **Outils.** Une page par décision, avec une comparaison, la prise en charge vérifiée du kit
  et ses limites : [frameworks HTTP](docs/tools/http-frameworks.fr.md),
  [validation](docs/tools/validation.fr.md),
  [paires de contrat](docs/tools/contract-pairs.fr.md),
  [injection de dépendances](docs/tools/dependency-injection.fr.md),
  [persistance](docs/tools/persistence.fr.md), [brokers de messages](docs/tools/message-brokers.fr.md),
  [cache et coordination](docs/tools/cache-and-coordination.fr.md),
  [caches HTTP](docs/tools/http-caches.fr.md),
  [stockage de fichiers](docs/tools/file-storage.fr.md),
  [identité](docs/tools/identity.fr.md),
  [moteurs d'autorisation](docs/tools/authorization-engines.fr.md),
  [observabilité](docs/tools/observability.fr.md),
  [analyse statique et pipeline](docs/tools/static-analysis-and-pipeline.fr.md),
  [socle de qualité](docs/tools/quality-baseline.fr.md),
  [lanceurs de tests](docs/tools/test-runners.fr.md),
  [SDK client](docs/tools/client-sdk.fr.md),
  [alias d'import](docs/tools/import-aliases.fr.md).
- **Guides.** [Méthodologie](docs/guides/methodology.fr.md), [quelle commande, quand](docs/guides/commands.fr.md),
  [travail en équipe](docs/guides/team-workflow.fr.md), [travail en parallèle](docs/guides/parallel-work.fr.md),
  [discipline des commits](docs/guides/commit-discipline.fr.md),
  [choisir le contrôle d'accès](docs/guides/choosing-access-control.fr.md),
  [quand extraire des microservices](docs/guides/when-to-extract-microservices.fr.md),
  [économie de tokens](docs/guides/token-economy.fr.md).
- **Propositions.** [Le côté lecture](docs/proposals/read-side.fr.md), avec l'état de sa
  construction.

## Application d'exemple

[examples/scheduling](examples/scheduling/README.fr.md) est une plateforme de prise de
rendez-vous pour des cabinets, construite avec le kit comme un utilisateur la construirait : à
partir d'une expression des besoins, à travers les neuf étapes, par plusieurs workers en
parallèle. Quatre contextes délimités (`scheduling`, le cœur, puis `identity`, `notification`
et `analytics`) tournent dans une application et un processus worker, sur Express,
class-validator, tsyringe, Knex sur PostgreSQL, l'outbox transactionnelle, Keycloak et une
autorisation par relations. C'est l'endroit où lire de vrais agrégats, des refus, des
politiques, des événements d'intégration et leurs tests ; son rapport d'outillage dit comment
le kit s'est comporté pendant la construction.

## Prérequis

Node 22.12 ou ultérieur. Les projets générés vérifient leurs types avec le compilateur
TypeScript 7 natif et gardent TypeScript 6 pour les outils qui ont encore besoin de son API.

## Contribuer

Voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md). Sous licence MIT.
