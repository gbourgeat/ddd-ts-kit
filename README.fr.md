[English](README.md) · **Français**
<!-- translation-of: README.md sha256:d547a0ed4a32e310 -->

<div align="center">

<img src="docs/assets/logo.svg" alt="" width="128" height="128">

# ddd-ts-kit

Domain-Driven Design (DDD), Clean Architecture (hexagonale, ports et adaptateurs) et Clean Code
pour les backends TypeScript et Node.js, tenus par des outils plutôt que par de bonnes
intentions. Vous décrivez le métier ; votre agent de code (Claude Code, Codex ou GitHub Copilot)
le construit avec le kit, et le kit le tient à l'architecture.

[![CI](https://github.com/gbourgeat/ddd-ts-kit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gbourgeat/ddd-ts-kit/actions/workflows/ci.yml)
[![Couverture](https://codecov.io/gh/gbourgeat/ddd-ts-kit/graph/badge.svg?branch=main)](https://codecov.io/gh/gbourgeat/ddd-ts-kit)
[![Version npm](https://img.shields.io/npm/v/ddd-ts-kit?color=3f9a77&label=npm)](https://www.npmjs.com/package/ddd-ts-kit)
[![Téléchargements npm](https://img.shields.io/npm/dm/ddd-ts-kit?color=3f9a77)](https://www.npmjs.com/package/ddd-ts-kit)
[![Node](https://img.shields.io/node/v/ddd-ts-kit?color=3f9a77)](#prérequis)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](docs/ARCHITECTURE.fr.md)
[![Licence MIT](https://img.shields.io/badge/license-MIT-3f9a77)](LICENSE)
[![PRs bienvenues](https://img.shields.io/badge/PRs-welcome-3f9a77)](#contribuer)

**[Documentation](https://gbourgeat.github.io/ddd-ts-kit/fr/)** ·
[Démarrage rapide](#démarrage-rapide) ·
[Exemple](examples/scheduling/README.fr.md) ·
[Article](https://medium.com/@gary.bourgeat/domain-driven-design-typescript-agents-ia-71200e05b261) ·
[Changelog](CHANGELOG.md) ·
[Discussions](https://github.com/gbourgeat/ddd-ts-kit/discussions) ·
[Contribuer](#contribuer)

</div>

## Pourquoi ddd-ts-kit

Le Domain-Driven Design et la Clean Architecture s'érodent un raccourci à la fois : un
`new Date()` dans un gestionnaire, un import entre deux contextes, une règle vérifiée dans un
contrôleur. Sous la pression d'une échéance, et plus encore avec un agent d'IA qui écrit cent
fichiers à l'heure, une consigne dans un wiki ne tient pas. ddd-ts-kit fait de l'architecture
des règles à identifiant, et les vérifie à chaque écriture de fichier, avant chaque fusion et à
chaque push.

- **Des règles, pas des consignes.** Chaque règle a un identifiant, une raison et une correction
  (`npx ddd-ts-kit explain <rule-id>`), vérifiées par une CLI sans dépendance, un plugin ESLint
  et dependency-cruiser.
- **Générer, pas taper.** `ddd-ts-kit generate` écrit 43 types de briques avec leur spec, leur
  fake et leur enregistrement, et laisse un `TODO(domain)` là où une décision métier est
  attendue.
- **Fait pour les agents de code.** Un plugin pour Claude Code, Codex et GitHub Copilot : des
  skills qui conduisent le travail étape par étape, des agents pour le travail en parallèle et la
  revue, et un hook qui vérifie chaque fichier TypeScript que l'agent écrit et nomme aussitôt
  la règle enfreinte.
- **Votre stack, pas la nôtre.** Express, Fastify, Hono ou NestJS ; zod, class-validator, TypeBox
  ou toute bibliothèque Standard Schema ; tsyringe, InversifyJS, Awilix, NestJS ou un câblage manuel ; Drizzle, Knex,
  Prisma ou TypeORM ; RabbitMQ, Kafka, NATS JetStream ou Redis Streams ; JWT ou Keycloak ;
  rôles, attributs ou relations.
- **Les exigences de la production, intégrées.** Outbox transactionnelle et consommateurs
  idempotents, une permission par cas d'usage, journal d'audit, OpenTelemetry, multitenancy,
  contrats OpenAPI et AsyncAPI, un pipeline de CI pour GitHub et GitLab.
- **Les données personnelles, par construction.** Ce qu'une table ou un événement garde d'une
  personne se déclare une fois ; en découlent l'effacement, l'export, la purge nocturne de ce qui
  a dépassé sa durée de conservation, le registre des données personnelles et les règles
  `privacy/*`, sur les quatre ORM, chaque demande d'une personne auditée. Les mécanismes de
  l'article 25 du RGPD, intégrés par défaut : la base légale, les finalités et la réponse à une
  personne restent les décisions du responsable de traitement
  ([Données personnelles](docs/concepts/personal-data.fr.md)).
- **Prêt à être découpé.** Chaque contexte délimité possède ses données et parle aux autres par
  des événements : il peut tourner comme son propre service le jour où l'équipe en a besoin.

L'histoire derrière le projet, sur Medium :
[Votre IA code vite. Votre architecture décide si ça tiendra.](https://medium.com/@gary.bourgeat/domain-driven-design-typescript-agents-ia-71200e05b261)
([en anglais](https://medium.com/@gary.bourgeat/domain-driven-design-typescript-ai-coding-agents-6981482928aa)).

La documentation est aussi un site web, avec une recherche, en français et en anglais :
<https://gbourgeat.github.io/ddd-ts-kit/fr/>. Chaque page a sa traduction à côté d'elle, à
laquelle mène le lien de sa première ligne.

## Démarrage rapide

Vous ne lancez pas ddd-ts-kit vous-même : votre agent de code le fait. Vous décrivez le métier,
répondez à ses questions et relisez ce qu'il écrit ; l'agent lance les générateurs, les
vérifications et la porte de qualité, et le hook du plugin vérifie chaque fichier TypeScript qu'il
écrit, nomme aussitôt la règle enfreinte et refuse une fois de s'arrêter tant qu'une erreur
demeure.

**1. Installez le plugin** dans l'agent que vous utilisez. Ce dépôt est sa marketplace :

| Agent | Installation | La skill `start` |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, puis `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, puis installer `ddd-ts-kit` depuis `/plugins` et approuver ses hooks dans `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, puis `copilot plugin install ddd-ts-kit@ddd-ts-kit` | par son nom, `start` |
| Agent cloud de Copilot, VS Code | déclaré par le `.github/copilot/settings.json` que le projet reçoit à son amorçage | par son nom, `start` |

**2. Ouvrez une session dans un dossier vide, et donnez-lui vos besoins :**

```text
/ddd-ts-kit:start Une API pour une boutique : les clients passent des commandes, chaque commande est facturée, puis expédiée.
```

L'agent conduit les sept premières des [neuf étapes](#démarrer-un-projet) une à une et s'arrête
pour votre décision à chaque choix stratégique. Il écrit la découverte, les contextes délimités
et leurs glossaires sous `docs/architecture/` pour que vous les relisiez, puis vous fait lancer
`/ddd-ts-kit:bootstrap`, planifie
les tranches et les construit un commit à la fois, vert sur toute la porte à chaque étape. Une
session ultérieure reprend depuis `docs/architecture/plan.md` : la même skill, sans argument.

La machine a besoin de Node 22.12 ou ultérieur : l'agent lance la CLI par `npx`. Sans le plugin,
l'`AGENTS.md` et les règles par couche qu'écrit l'amorçage guident tout de même chaque agent.

## Démarrer un projet

Suivez ces étapes dans l'ordre : c'est le chemin pris en charge, et les outils sont faits pour
le tenir. Chaque étape est une skill du plugin (`/ddd-ts-kit:<skill>`), ou une commande, et
laisse un fichier que la suivante lit. `/ddd-ts-kit:start` conduit les étapes 1 à 7 une à une,
et, une fois le projet écrit par `init` (étape 5), `npx ddd-ts-kit status` dit à tout moment quelle
étape vient ensuite : avant, `/ddd-ts-kit:start` lit `docs/architecture/plan.md`.

| # | Étape | Skill ou commande | Produit |
|---|---|---|---|
| 1 | Découvrir le domaine | `discover-domain` | `docs/architecture/discovery.md` : acteurs, commandes, événements, politiques |
| 2 | Trouver les contextes délimités | `bounded-contexts` | `docs/architecture/contexts.md` : chaque frontière et sa raison |
| 3 | Écrire les glossaires | `glossary` | le langage omniprésent de chaque contexte |
| 4 | Dessiner la carte des contextes | `context-map` | qui est en amont de qui, et selon quel patron |
| 5 | Choisir la stack et démarrer | `bootstrap`, `ddd-ts-kit init`, `generate context` | le projet, vert sur `verify`, un `CONTEXT.md` par contexte |
| 6 | Planifier les tranches | `plan-slices` | `docs/architecture/slices.md` : un cas d'usage par tranche, dans l'ordre |
| 7 | Construire tranche par tranche | `use-case` (`parallel-work` pour plusieurs workers) | le code et ses tests, un commit par tranche |
| 8 | Passer la porte de qualité | `quality-gate`, `npm run verify` | une porte verte avant chaque fusion |
| 9 | Documenter | `document`, `npm run docs:generate` | des contrats, une carte des contextes et des enregistrements de décision à jour |

![Les neuf étapes : quatre écrites dans les mots du métier sous docs/architecture/ (découvrir le domaine, trouver les contextes, écrire les glossaires, dessiner la carte des contextes), puis cinq avec les générateurs (démarrer, planifier les tranches, construire une tranche, passer la porte, documenter) ; les étapes 7 et 8 se répètent pour chaque tranche](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-workflow.fr.svg)

La [méthodologie](docs/guides/methodology.fr.md) est la référence de chaque étape et dit ce que
coûte d'en sauter une ; [quelle commande, quand](docs/guides/commands.fr.md) donne la commande
de chaque moment d'un projet.

## Ce que l'agent exécute

Derrière chaque étape, l'agent tape les commandes de la CLI : vous les voyez dans sa session,
vous pouvez les taper vous-même, et le pipeline lance les mêmes. `init` ne crée pas de dépôt : dans un
nouveau répertoire, lancez d'abord `git init`, sinon les hooks git du bootstrap n'ont nulle part où aller.
Un nouveau projet commence par :

```bash
mkdir orders-api && cd orders-api
npx ddd-ts-kit init
pnpm install
pnpm run verify           # types, lint, format, tests, e2e, architecture, graphe des imports, code mort, dérive de la documentation
```

`init` sans option prend Express, zod, tsyringe, Drizzle sur PostgreSQL, Vitest et pnpm, que
npm installe (`npm install --global pnpm`, une fois par machine ; pnpm exécute ensuite la version
qu'épingle le projet ; Node 25 et suivants ne livrent plus corepack). Le projet est vert dès ce premier `verify`, avant une ligne de code métier, et le
reste à chaque étape. Ensuite, le langage omniprésent d'abord, le code ensuite :

```bash
pnpm exec ddd-ts-kit generate context ordering --classification core \
  --term "Order=A customer's request to buy products" --term "Place=To submit an order for fulfilment"
pnpm exec ddd-ts-kit generate context billing --classification supporting --upstream ordering:customer-supplier
pnpm exec ddd-ts-kit generate aggregate ordering Order
pnpm exec ddd-ts-kit generate repository ordering Order
pnpm exec ddd-ts-kit generate command ordering PlaceOrder --permission order.place --grant customer --aggregate Order --creates
pnpm exec ddd-ts-kit generate route ordering PlaceOrder --method POST --path /orders
pnpm run docs:generate    # le contrat OpenAPI suit la nouvelle route
pnpm run verify
pnpm exec ddd-ts-kit status   # ce qui reste : TODO(domain), TODO(platform) et it.todo par contexte
```

Ces deux blocs sont exécutés tels qu'ils sont écrits, ligne par ligne, par la suite de bout en
bout de ce dépôt, sur pnpm et sur npm. Avec `npx ddd-ts-kit init --package-manager npm`, les
mêmes lignes se lisent `npm install`, `npm run <script>` et `npx ddd-ts-kit <command>`. Pour
voir l'application tourner : `cp .env.example .env`, `pnpm run infra:up` (PostgreSQL, dans
Docker), `pnpm run db:generate initial`, `pnpm run db:migrate`, puis `pnpm run dev`
(rechargement automatique ; documentation de l'API sur `/docs`).

Un nom absent du glossaire du contexte est refusé, tout comme une commande ou une requête qui ne
déclare ni permission ni `--public`. [Une tranche, de bout en bout](docs/guides/first-slice.fr.md)
suit la requête HTTP `POST /orders` à travers les quatre couches et montre le code une fois les
endroits `TODO(domain)` remplis.

## Ce qui est imposé

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

| Au lieu de | Écrivez | Règle |
|---|---|---|
| `new Date()` | `this.clock.now()`, le port `Clock` reçu dans le constructeur | `purity/no-system-clock` |
| `crypto.randomUUID()` | `this.ids.next()`, le port `IdGenerator` | `purity/no-ambient-randomness` |
| `throw new Error('Empty order')` | `throw OrderEmpty.onPlacement()`, un refus nommé dans les mots du métier, avec un code stable | `domain/no-generic-error` |
| un import de `infrastructure/` dans un gestionnaire | le port `OrderRepository`, lié à son adaptateur par la plateforme | `layer/application-inward` |
| un import du `domain/` d'un autre contexte | le `published-language/` de ce contexte, ou un événement d'intégration | `context/published-language-only` |

Le même cas d'usage écrit dans les règles se trouve dans
[Une tranche, de bout en bout](docs/guides/first-slice.fr.md). Les règles couvrent, entre
autres :

- **Couches et contextes** (`layer/*`, `context/*`, `tree/*`) : le domaine n'importe rien
  d'autre que lui-même et le kernel ; un autre contexte n'est atteint que par son langage
  publié ; aucun cycle.
- **Langage omniprésent** (`language/*`) : les classes du domaine et les cas d'usage sont nommés
  avec les termes du glossaire du contexte.
- **DDD tactique et pureté** (`domain/*`, `application/*`, `events/*`, `purity/*`) : des
  agrégats encapsulés, des objets-valeurs immuables, des erreurs spécifiques, le temps et les
  identifiants par des ports.
- **Ports et câblage** (`ports/*`, `declarations/*`, `composition/*`) : un port est une classe
  abstraite et son propre jeton d'injection, assemblé en un seul endroit.
- **Contrôle d'accès** (`authz/*`) : chaque cas d'usage déclare sa permission ou dit qu'il est
  public, décidée dans la couche application, avec un acteur explicite.
- **Clean code et tests** (`clean/*`, `test/*`) : de petites fonctions en ordre d'escalier,
  aucune échappatoire, une spec pour chaque unité de comportement, aucun mock.
- **Données personnelles** (`privacy/*`, avertissements, avec `--privacy on`) : une colonne ou un
  champ d'événement nommé comme une donnée personnelle est déclaré, un contexte qui copie une
  personne efface sa copie, un sujet est un identifiant opaque, une ligne de journal ne nomme
  jamais un champ personnel déclaré.

`npx ddd-ts-kit rules` liste chaque identifiant avec sa sévérité ; la
[référence de l'architecture](docs/ARCHITECTURE.fr.md) les définit.

![Les mêmes règles vérifiées à trois moments : à chaque écriture de fichier par le hook du plugin, avant chaque fusion par npm run verify, et à chaque pull request par le pipeline de CI, les trois appliquant les règles définies dans docs/ARCHITECTURE.md](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-checks.fr.svg)

## Le plugin pour agents de code

Ce dépôt est la marketplace du plugin pour Claude Code, Codex et GitHub Copilot ; le
[démarrage rapide](#démarrage-rapide) dit comment chaque agent l'installe. Vingt-six skills conduisent un projet d'une expression des besoins jusqu'à des contextes qui
fonctionnent, six agents explorent, construisent un contexte dans son propre worktree,
écrivent les specs, relisent, jugent un changement d'un test d'acceptation verrouillé et
vérifient une story à sa clôture dans un contexte neuf, et le hook refuse un fichier écrit à la main là où un générateur
existe et vérifie chaque fichier écrit. Même sans plugin, l'`AGENTS.md` et les règles par couche
qu'écrit `init` guident chaque agent. [Le plugin pour agents de code](docs/guides/coding-agents.fr.md)
liste les skills et dit ce que chaque hôte exécute.

## Packages

| Package | Ce qu'il apporte |
|---|---|
| [`ddd-ts-kit`](packages/cli) | la CLI : `init`, `generate`, `check`, `docs`, `sdk`, `status`, `rules`, `explain` et d'autres |
| [`@ddd-ts-kit/kernel`](packages/kernel) | entités, agrégats, objets-valeurs, erreurs, ports, les déclarations, bus de commandes, de requêtes et d'événements, les interfaces standard ; aucune dépendance |
| [`@ddd-ts-kit/events`](packages/events) | événements d'intégration typés, outbox transactionnelle et relais, AsyncAPI et catalogue d'événements |
| [`@ddd-ts-kit/rabbitmq`](packages/rabbitmq), [`kafka`](packages/kafka), [`nats`](packages/nats), [`redis/event-bus`](packages/redis) | fournisseurs de brokers derrière un seul contrat : publication acquittée, abonnements durables, nouvelles tentatives, files de rejet |
| [`@ddd-ts-kit/scheduling`](packages/scheduling) | des jobs lancés par le temps qui ne font que déclencher des cas d'usage, une seule exécution sur l'ensemble des instances |
| [`@ddd-ts-kit/auth`](packages/auth) | acteurs, une permission par cas d'usage, refus par défaut ; autoriseurs par rôles, par attributs et par relations ; JWT |
| [`@ddd-ts-kit/openfga`](packages/openfga) | les relations d'`auth` sur un serveur OpenFGA |
| [`@ddd-ts-kit/aspects`](packages/aspects) | journalisation, métriques, nouvelle tentative, délai d'expiration, disjoncteur, cache et cloison appliqués de l'extérieur |
| [`@ddd-ts-kit/audit`](packages/audit) | journal d'audit chaîné par hachage, en ajout seul |
| [`@ddd-ts-kit/redis`](packages/redis) | cache, verrou, limiteur de débit et signal de relais sur Redis, Dragonfly ou Valkey |
| [`@ddd-ts-kit/s3`](packages/s3) | stockage de fichiers sur AWS S3, MinIO, OVHcloud, Scaleway ou Cloudflare R2 |
| [`@ddd-ts-kit/opensearch`](packages/opensearch) | le modèle de lecture d'une projection dans OpenSearch, chaque locataire dans un index ou derrière un alias filtré |
| [`@ddd-ts-kit/http`](packages/http) | des routes déclarées une fois, montées sur Express, Fastify, Hono ou NestJS ; erreurs RFC 9457 ; OpenAPI 3.1 ; cache HTTP |
| [`@ddd-ts-kit/validation`](packages/validation) | un seul port `Schema` au-dessus de zod, class-validator, TypeBox et Standard Schema |
| [`@ddd-ts-kit/di`](packages/di) | des modules de contexte sur tsyringe, InversifyJS ou Awilix, les classes de port comme jetons, une application de test avec des fakes |
| [`@ddd-ts-kit/pino`](packages/pino), [`winston`](packages/winston) | le port `Logger` du kernel sur pino ou winston |
| [`@ddd-ts-kit/sentry`](packages/sentry) | le port `ErrorReporter` du kernel sur Sentry ou GlitchTip |
| [`@ddd-ts-kit/tracing`](packages/tracing) | OpenTelemetry câblé une fois par la plateforme |
| [`@ddd-ts-kit/testing`](packages/testing) | builders, scénarios étant donné / quand / alors, suites de contrat, harnais de bout en bout |
| [`@ddd-ts-kit/drizzle`](packages/drizzle), [`knex`](packages/knex), [`prisma`](packages/prisma), [`typeorm`](packages/typeorm) | unité de travail, stockage de l'outbox, modèles de lecture, isolation des tenants, magasin d'événements |
| [`@ddd-ts-kit/eslint-plugin`](packages/eslint-plugin) | les règles de code sur l'arbre syntaxique, avec des préréglages |

Tout passe par des ports du kernel, si bien que chaque pièce est remplaçable : un autre broker,
un autre ORM ou un autre framework HTTP est un adaptateur qui passe la même suite de contrat. Le
README de chaque package dit ses limites et ce qui a été vérifié.

![Où chaque package est importé : dans un contexte délimité, le domaine n'importe que le kernel, l'application y ajoute auth, la présentation importe http et validation, l'infrastructure un package d'ORM, le langage publié events et validation ; la plateforme compose les contextes avec di et les packages de ses capacités techniques](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-packages.fr.svg)

## Pipeline

`init --ci github|gitlab|both` installe les mêmes portes sur l'une ou l'autre plateforme :
vérification des types, lint, architecture, code mort, tests unitaires avec seuils de
couverture, tests d'intégration sur PostgreSQL, tests de bout en bout, dérive de la
documentation et du contrat, sécurité et construction de l'image, derrière une seule porte
finale, et chaque nuit le score de mutation des couches domaine et application, chacune tenue à son
plancher, une *pull request* lisant les survivants de son changement. Chaque outil est gratuit sur
n'importe quel dépôt. Les détails :
[pipeline/README.md](pipeline/README.md).

## Documentation

- [Index de la documentation](docs/README.fr.md) : chaque page, et un ordre de lecture pour qui
  découvre le DDD, pour un tech lead qui adopte le kit et pour un contributeur.
- [Référence de l'architecture](docs/ARCHITECTURE.fr.md) (normative) et
  [configuration](docs/CONFIG.fr.md).
- [Concepts](docs/concepts/README.fr.md) : une page par idée, des contextes délimités à l'event
  sourcing.
- [Guides](docs/guides/methodology.fr.md) et [comparaisons d'outils](docs/README.fr.md#outils--une-page-par-décision) :
  la méthodologie, le travail en équipe et en parallèle, et une page par choix technique.

## Application d'exemple

[examples/scheduling](examples/scheduling/README.fr.md) est une plateforme de prise de
rendez-vous construite avec le kit comme un utilisateur la construirait : à partir d'une
expression des besoins, à travers les neuf étapes, par plusieurs workers en parallèle. Quatre
contextes délimités sur Express, class-validator, tsyringe, Knex sur PostgreSQL, l'outbox
transactionnelle, Keycloak et une autorisation par relations.

## Prérequis

Node 22.12 ou ultérieur. Les projets générés vérifient leurs types avec le compilateur
TypeScript 7 natif et gardent TypeScript 6 pour les outils qui ont encore besoin de son API.

## Communauté et aide

- **Questions et idées** : [GitHub Discussions](https://github.com/gbourgeat/ddd-ts-kit/discussions).
- **Bugs et propositions** : les [issues](https://github.com/gbourgeat/ddd-ts-kit/issues/new/choose),
  à partir de leurs modèles.
- **Sécurité** : jamais dans une issue publique ; voir [SECURITY.fr.md](SECURITY.fr.md).
- Chaque participant suit le [code de conduite](CODE_OF_CONDUCT.fr.md).

## Contribuer

ddd-ts-kit se construit en public, et les contributions de toute taille sont les bienvenues :
une coquille, une traduction, un test, un adaptateur ou une nouvelle règle. De bons points de
départ :

- les issues étiquetées
  [good first issue](https://github.com/gbourgeat/ddd-ts-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
  ou [help wanted](https://github.com/gbourgeat/ddd-ts-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) ;
- un adaptateur pour un broker, un ORM ou un framework HTTP que le kit ne prend pas encore en
  charge : il passe la suite de contrat de son port ;
- la documentation, en anglais ou en français, et l'[application d'exemple](examples/scheduling/README.fr.md) ;
- un retour d'un vrai projet, dans les [Discussions](https://github.com/gbourgeat/ddd-ts-kit/discussions) :
  ce qui a tenu, ce qui a gêné.

[CONTRIBUTING.fr.md](CONTRIBUTING.fr.md) donne l'installation, les règles de base et le chemin
d'un changement jusqu'à `main`. Si ddd-ts-kit vous est utile, une étoile sur GitHub aide d'autres
personnes à le trouver.

[![Historique des étoiles de ddd-ts-kit](https://api.star-history.com/svg?repos=gbourgeat/ddd-ts-kit&type=Date)](https://star-history.com/#gbourgeat/ddd-ts-kit&Date)

## Contributeurs

Les personnes qui construisent ddd-ts-kit, puis toutes celles dont les commits sont arrivés sur `main`.

<table>
  <tr>
    <td align="center"><a href="https://github.com/gbourgeat"><img src="https://github.com/gbourgeat.png?size=160" width="80" alt=""><br><sub><b>Gary Bourgeat</b></sub></a><br><sub>mainteneur</sub></td>
    <td align="center"><a href="https://github.com/jd-bargy"><img src="https://github.com/jd-bargy.png?size=160" width="80" alt=""><br><sub><b>Jean-Daniel Bargy</b></sub></a></td>
  </tr>
</table>

<a href="https://github.com/gbourgeat/ddd-ts-kit/graphs/contributors"><img src="https://contrib.rocks/image?repo=gbourgeat/ddd-ts-kit" alt="Les contributeurs de ddd-ts-kit"></a>

## Licence

[MIT](LICENSE) © Gary Bourgeat et les contributeurs.
