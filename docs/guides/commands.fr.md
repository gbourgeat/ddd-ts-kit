[English](commands.md) · **Français**
<!-- translation-of: commands.md sha256:4153296730e6fbdb -->

# Quelle commande, quand

**Résumé.** Les commandes de la CLI et les *skills* du *plugin*, rangés selon le moment de la vie
d'un projet où on les appelle : ce que fait chacun, ce qu'il laisse derrière lui, et ce qui vient
d'habitude ensuite. L'ordre des moments est celui de la [méthodologie](methodology.fr.md), qui est
le chemin pris en charge ; cette page dit comment le parcourir. La dernière partie est la
référence de chaque commande et de chaque option, générée à partir de l'aide de la CLI.

Les commandes sont écrites pour npm. Sous pnpm, `npx ddd-ts-kit` se lit `pnpm exec ddd-ts-kit` et
`npm run` se lit `pnpm run`. Un *skill* se tape dans Claude Code, le *plugin* installé :
`/ddd-ts-kit:<skill>` ; l'agent utilise aussi la plupart d'entre eux de lui-même quand la
situation s'y prête.

![Les six moments d'un projet dans l'ordre, démarrer, modéliser le domaine, construire une tranche, avant un commit, avant une pull request, publier et déployer, chacun avec ses skills et ses commandes ; la tranche suivante reboucle sur construire une tranche ; relier deux contextes et la persistance viennent dans une tranche ; un refus ou une mise à jour du kit peut survenir à tout moment](../assets/diagrams/commands-moments.fr.svg)

Les sections ci-dessous suivent ces moments. L'essentiel du temps se passe dans la boucle qui va
de [Construire une tranche](#construire-une-tranche) à
[Avant une pull request](#avant-une-pull-request), une tranche par tour de boucle.

## Une première fonctionnalité, à partir de zéro

La séquence réaliste pour un service de prise de commandes, chaque ligne dans l'ordre où on la
tape :

| # | Commande | Laisse |
|---|---|---|
| 1 | `/ddd-ts-kit:start We take orders from shops and bill them monthly` | `docs/architecture/plan.md`, puis `discovery.md`, `contexts.md`, le glossaire et la carte des contextes, une étape par tour, chacune close sur votre oui |
| 2 | `/ddd-ts-kit:bootstrap` (ou `npx ddd-ts-kit init`, `npm install`, `npm run verify`) | le projet, vert avant tout code métier |
| 3 | `npx ddd-ts-kit generate context ordering --classification core --term "Order=A shop's request to buy products" --term "Place=To submit an order"` | `src/contexts/ordering/` et son `CONTEXT.md` avec le glossaire |
| 4 | `/ddd-ts-kit:plan-slices` | `docs/architecture/slices.md` : `PlaceOrder` d'abord |
| 5 | `/ddd-ts-kit:use-case PlaceOrder`, qui lance `generate aggregate ordering Order`, `generate repository ordering Order`, `generate command ordering PlaceOrder --permission order.place --aggregate Order`, `generate route ordering PlaceOrder --method POST --path /orders`, `generate e2e ordering PlaceOrder` | les fichiers, leurs *specs* et leurs *fakes*, et les endroits `TODO(domain)` à remplir |
| 6 | `npx ddd-ts-kit todo ordering` | ce qui reste à écrire dans la tranche, sous forme de `file:line` |
| 7 | `npm run db:generate place-order`, `npm run docs:generate` | la migration de la nouvelle table, le contrat OpenAPI avec `POST /orders` |
| 8 | `/ddd-ts-kit:quality-gate`, c'est-à-dire `npm run verify` | une porte verte |
| 9 | `/ddd-ts-kit:commit-discipline` | un *commit* pour la tranche, les fichiers générés avec lui |
| 10 | `npx ddd-ts-kit status` | la tranche suivante du plan |

La ligne 5 est celle où les générateurs tapent à votre place. Avec Drizzle choisi à `init`, les
cinq commandes qu'elle lance écrivent ces fichiers, chacun dans sa couche :

![Les fichiers écrits par generate aggregate, repository, command, route et e2e pour la tranche PlaceOrder : les routes et le contrôleur en présentation, les permissions, la commande et le gestionnaire en application, l'agrégat et le port de repository dans le domaine, le repository Drizzle, le mapper et le schéma en infrastructure, le builder, le fake, la suite de contrat et les specs sous test, et la spec de bout en bout hors du contexte](../assets/diagrams/commands-first-slice-files.fr.svg)

Aucun de ces fichiers ne contient encore de code métier. La plupart contiennent des marqueurs
`TODO(domain)` là où une décision vous revient ; trois arrivent câblés et n'en contiennent aucun
(le groupe de routes `orders.routes.ts`, les permissions `ordering.permissions.ts` et
l'adaptateur `drizzle-order.repository.ts`). Les *specs* générées contiennent des entrées
`it.todo`. La ligne 6 les liste, une ligne chacun, dans l'ordre des fichiers :

```text
$ npx ddd-ts-kit todo ordering
src/contexts/ordering/CONTEXT.md:5  TODO(domain)  say in two sentences which business capability this context owns and for whom; the first sentence is reused in the context map.
src/contexts/ordering/application/commands/place-order/place-order.command.ts:7  TODO(domain)  declare the input of "place order" as a constructor with the actor first, then readonly primitives and ids, ...
src/contexts/ordering/application/commands/place-order/place-order.handler.ts:16  TODO(domain)  decide what "place order" does to a Order: ...
src/contexts/ordering/domain/aggregates/order.aggregate.ts:28  TODO(domain)  add one method per business intention (issue, cancel, ...): each guards its invariants, replaces `this.state` and records the event of what happened.
...
src/contexts/ordering/test/unit/order.aggregate.spec.ts:33  it.todo  records the fact of its birth
...
```

La tranche est finie quand `todo ordering` n'en liste plus rien.

## Démarrer un projet

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `/ddd-ts-kit:start` | conduit les étapes 1 à 7 de la méthode, une par tour, et reprend à partir du plan | en premier, avant tout code ; de nouveau pour reprendre | `docs/architecture/plan.md` et l'artefact de chaque étape | l'étape que nomme sa ligne `Next:` |
| `/ddd-ts-kit:bootstrap` | choisit la *stack* selon des critères, lance `init`, crée les contextes | étape 5, une fois la carte des contextes esquissée | le projet et un `CONTEXT.md` par contexte | `/ddd-ts-kit:plan-slices` |
| `npx ddd-ts-kit init [flags]` | écrit la configuration, la plateforme, le *pipeline*, les règles de l'agent | l'amorçage ; `--dry-run` d'abord pour lire ce qu'il écrit | un projet qui passe `npm run verify` | `npm install`, `npm run verify` |
| `npx ddd-ts-kit init --preset identity`, `generate context <name> --preset identity` | écrit un contexte générique en entier au lieu d'un contexte vide : les comptes venus du fournisseur d'identité, les organisations, les membres et les rôles, les invitations, les délégations ([pourquoi et lesquels](bootstrap-with-well-designed-contexts.fr.md)) | quand `contexts.md` contient un contexte générique d'identité | le contexte, ses *specs*, ses adaptateurs et son glossaire, verts d'emblée | lire sa section `## Design`, puis les tranches du cœur |
| `npx ddd-ts-kit status` | la prochaine étape du plan, les tranches par statut et par responsable, ce qui reste par contexte | au début de chaque session | un texte court, `--json` pour des données | l'étape ou la tranche qu'il nomme |

## Modéliser le domaine

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `/ddd-ts-kit:discover-domain` | un *event storming* écrit : acteurs, commandes, événements, politiques, modèles de lecture | étape 1 | `docs/architecture/discovery.md` | `/ddd-ts-kit:bounded-contexts` |
| `/ddd-ts-kit:bounded-contexts` | trouve et classe les contextes, avec la raison de chaque frontière | étape 2 | `docs/architecture/contexts.md` | `/ddd-ts-kit:glossary` |
| `/ddd-ts-kit:glossary` | le langage omniprésent d'un contexte | étape 3, et avant tout nouveau nom | `docs/architecture/glossary.md`, puis le `## Ubiquitous language` de chaque `CONTEXT.md` | `/ddd-ts-kit:context-map` |
| `/ddd-ts-kit:context-map` | amont, aval, patron et contrat de chaque paire | étape 4, et quand deux contextes commencent à dépendre l'un de l'autre | `docs/architecture/context-map.md`, puis les amonts de la configuration | l'amorçage, ou la tranche qui en a besoin |
| `npx ddd-ts-kit generate context <name> --classification <c> --term ... --upstream ...` | déclare un contexte avec son langage et ses relations | après l'amorçage, un par ligne de `contexts.md`, les amonts d'abord | le répertoire du contexte, son `CONTEXT.md`, l'entrée de configuration | `npx ddd-ts-kit docs` |
| `npx ddd-ts-kit list`, `describe <context>` | ce qui existe, par contexte ou pour un seul | avant de planifier ou de modifier un contexte | une carte des contextes, ou un contexte sous forme de faits (`--json`) | `/ddd-ts-kit:plan-slices` |

## Construire une tranche

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `/ddd-ts-kit:plan-slices` | le travail en tranches verticales, ordonnées, avec leurs commandes de générateur | étape 6, après l'amorçage | `docs/architecture/slices.md` | `/ddd-ts-kit:use-case` |
| `/ddd-ts-kit:use-case <UseCase>` | une tranche de bout en bout, test d'abord | pour chaque ligne des tranches | domaine, gestionnaire, route et *specs*, remplis | `npm run verify` |
| `npx ddd-ts-kit generate <kind> ...` | un fichier d'un rôle avec sa *spec*, son *fake* et son enregistrement (liste ci-dessous) | chaque fois qu'il faut un fichier d'un rôle, jamais à la main | le fichier et les endroits `TODO(domain)`, `--json` pour la liste | remplir les endroits, puis `todo` |
| `npx ddd-ts-kit todo [<context>]` | chaque `TODO(domain)`, `TODO(platform)`, `it.todo` et `TODO(review)` restant | avant de clore une tranche, une story ou un jalon | des entrées `file:line` | les écrire, puis `npm test` ; régler chaque `TODO(review)` ou l'écarter par `generate adr` avant de clore la story ou le jalon |
| `/ddd-ts-kit:parallel-work` | répartit les tranches entre des *workers*, un contexte chacun | quand plusieurs agents ou personnes construisent en même temps | une consigne par *worker*, des *worktrees* `npx ddd-ts-kit worker-scope <context>` | le `use-case` de chaque *worker* |

## Relier deux contextes

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `/ddd-ts-kit:integration-event` | un événement versionné dans le langage publié du producteur, son consommateur en aval | un contexte doit réagir à un autre | la déclaration, la publication par l'outbox, un gestionnaire idempotent | `npm run docs:generate` |
| `npx ddd-ts-kit generate integration-event <context> <Aggregate> <Fact>` | déclare l'événement | dans la tranche amont | `published-language/*.integration-event.ts` et sa charge utile | `generate integration-handler` en aval |
| `npx ddd-ts-kit generate integration-handler <context> <upstream> <eventType>` | le consommateur, nommé d'après l'événement, ou comme la conception l'appelle avec `--name <Name>` (le nom du consommateur suit) | dans la tranche aval | le gestionnaire, sa *spec*, son enregistrement | `npm run docs:generate` |
| `npx ddd-ts-kit generate acl` ou `gateway` | une couche anticorruption, ou un besoin synchrone derrière un port | un aval qui ne doit pas prendre le modèle de l'amont | le port et son adaptateur | la note de la carte des contextes |

## Persistance

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `/ddd-ts-kit:persistence` | port de *repository*, adaptateur ORM, *mapper*, *fake*, suite de contrat | un nouvel agrégat, une nouvelle table ou un nouveau modèle de lecture | l'adaptateur et ses *specs* | `npm run db:generate <what-it-does>` |
| `npx ddd-ts-kit generate repository <context> <Aggregate>` | le port, le *fake* en mémoire et l'adaptateur ORM | avec la première tranche d'un agrégat | les fichiers et la table du schéma à remplir | `npm run db:generate <what-it-does>` |
| `npm run db:generate <what-it-does>` | une migration à partir du schéma, nommée `<timestamp>_<what-it-does>` | après un changement du schéma | `migrations/` (`prisma/migrations/` sous Prisma) | `npm run db:migrate`, `npm run check:arch` |
| `npm run infra:up`, `npm run db:migrate`, `npm run dev` | la base de données dans Docker, migrée, l'application avec rechargement | pour la voir tourner | une API qui tourne, sa documentation sur `/docs` | `npm run test:e2e` |

## Avant un commit

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `npx ddd-ts-kit verify-slice <context> --since <ref>` | en une passe : `npm run regenerate`, les règles d'architecture sur les fichiers modifiés depuis la référence (nouveaux compris), les tests du contexte, les fichiers modifiés proches de la limite de 350 lignes | avant le commit d'une tranche, à relancer jusqu'à ce qu'elle passe | chaque étape avec sa cause, puis les chemins à indexer | le commit de la tranche |
| `npx ddd-ts-kit check --changed-since <ref>` | les règles d'architecture sur ce qui a changé | pendant l'itération | des violations avec leur correction | `npx ddd-ts-kit explain <rule-id>` quand l'une n'est pas claire |
| `npm run regenerate` (`npx ddd-ts-kit depcruise-config --write`, puis `npm run docs:generate`, qui lance `npx ddd-ts-kit docs`) | régénère tous les fichiers dérivés : `.dependency-cruiser.cjs`, la carte des contextes, les listes des `CONTEXT.md`, les *barrels* et les contrats | après un changement d'une route, d'un schéma, d'un événement ou de la configuration | les fichiers générés, commités avec le code | `/ddd-ts-kit:commit-discipline` |
| `/ddd-ts-kit:commit-discipline`, `npx ddd-ts-kit check --commit-size --staged` | une tranche par *commit*, sa taille comparée à la configuration | avant `git commit` (le *hook* lance le contrôle) | un message `<type>(<context>): ...` | la tranche suivante |

## Avant une pull request

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `/ddd-ts-kit:quality-gate`, `npm run verify` | chaque porte du *pipeline*, corrigée à la racine | avant d'ouvrir la *pull request* ou la *merge request* | une porte verte | la *request* |
| `npx ddd-ts-kit affected --base origin/main` | les contextes qu'un changement atteint à travers la carte des contextes | dans le *pipeline* ; en local pour voir ce qu'il lancera | des filtres pour les tests et le *linter* | le *pipeline* |
| agent `architecture-reviewer` | une revue en lecture seule du *diff* au regard des règles | avant de fusionner une tranche | des constats avec fichier et ligne | les corrections, puis la fusion |

## Publier et déployer

| Commande | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `npm run build`, `npm start` | compile, réécrit les alias de `dist/`, l'exécute avec Node seul | pour livrer | `dist/` | l'image |
| `docker build .` | l'image du `Dockerfile` qu'a écrit `init` (le *pipeline* la construit sans la pousser) | pour livrer | une image | `npm run db:migrate` sur la base de données cible, puis le déploiement |
| `npx ddd-ts-kit sdk` (ou `init --sdk`) | génère le client typé de chaque document du contrat sous `clients/<document>`, câble ses scripts et le tient à jour (`docs:generate` le lance, `docs:check` le compare) | quand une autre équipe, un *front end* ou un test appelle l'API | un *package* de *workspace* par document, construit par `npm run sdk:build` | `npm publish --workspace clients/<document>` à la main, voir [le SDK client](../tools/client-sdk.fr.md) |
| `npx ddd-ts-kit generate worker`, `generate service <context>` | un processus pour les *jobs*, ou un contexte exécuté seul | quand les *jobs* ou un contexte doivent monter en charge à part | `src/apps/<name>/main.ts` | `/ddd-ts-kit:extract-service` |

## Migrer après une mise à jour du kit

| Commande | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| lire [CHANGELOG.md](../../CHANGELOG.md), livré aussi en `node_modules/ddd-ts-kit/CHANGELOG.md` | ce qui a changé et ce qu'il faut faire | avant la mise à jour, ou quand le début de session dit que le *plugin* décrit une autre version | les étapes de la version | mettre à jour ensemble les versions de `@ddd-ts-kit/*` et de `ddd-ts-kit` |
| `npx ddd-ts-kit init --force` | réécrit les fichiers que possède `init`, garde la configuration et recâble les contextes | après la mise à jour | les fichiers de plateforme et de *pipeline* de la nouvelle version, et des notes | `npm run verify` |
| `npx ddd-ts-kit controllers`, `error-factories --plan` puis `--apply`, `value-objects` | déplace les routes en fonctions vers des contrôleurs, les classes d'erreur vers des fabriques, les objets-valeurs d'un `Result` vers des fabriques qui lèvent une erreur | quand le projet adopte ces formes | les fichiers réécrits et la clé de configuration | `npx ddd-ts-kit docs`, `npm run verify` |
| `npm run regenerate` | régénère ce qui découle de la configuration | après tout changement de la configuration | `.dependency-cruiser.cjs`, les documents générés | `npm run verify` |

## Quand quelque chose est refusé

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `npx ddd-ts-kit explain <rule-id>` | la raison d'une règle et un exemple dans chaque sens | une violation n'est pas claire | l'explication | corriger la cause |
| `npx ddd-ts-kit check-file <path>`, `rules` | un fichier contrôlé ; chaque identifiant de règle | après une modification ; pour retrouver une règle | des violations ; la liste | corriger la cause |
| `generate ... --term "<Term>=<meaning>"` | ajoute au glossaire le mot manquant pendant la génération | le générateur refuse un nom absent du glossaire | le terme dans `CONTEXT.md` | `/ddd-ts-kit:glossary` si le sens est incertain |
| `/ddd-ts-kit:deviation`, `npx ddd-ts-kit generate adr "<title>" --deviation <what> --reason "<why>"` | soumet l'exception au propriétaire et l'enregistre | seulement quand le propriétaire accepte de contourner une règle | un enregistrement de décision et l'entrée de configuration | `npm run verify` |

Chaque refus dit quoi faire ensuite. Le générateur refuse un nom que le glossaire du contexte ne
contient pas, et n'écrit rien :

```text
$ npx ddd-ts-kit generate command ordering CancelOrder --permission order.cancel --aggregate Order
error: "CancelOrder" uses "cancel", which the glossary of src/contexts/ordering/CONTEXT.md does not define.
  fix: Either use an existing term (Order, Place), or add the term in the same command: --term "Cancel=<what it means for the business>". The glossary is written before the code (rule language/glossary-term).
```

si bien que la même commande, avec le sens du mot, passe :

```bash
npx ddd-ts-kit generate command ordering CancelOrder --permission order.cancel --aggregate Order \
  --term "Cancel=To withdraw an order before it is shipped"
```

Le *checker* signale une violation avec son identifiant de règle et une phrase de correction. Ici,
un fichier du contexte `notification` de l'application d'exemple importe un agrégat de
`scheduling` :

```text
$ npx ddd-ts-kit check-file src/contexts/notification/application/commands/probe.ts
src/contexts/notification/application/commands/probe.ts:1  error  context/published-language-only
  "notification" imports the internals of "scheduling" (src/contexts/scheduling/domain/aggregates/appointment.aggregate.ts).
  fix: Import from src/contexts/scheduling/published-language only; if the type is missing there, publish it with `ddd-ts-kit generate integration-event scheduling <Aggregate> <Fact>` or react to an integration event.

1 error, 0 warnings, 0 suppressions in 1 file.
```

et `explain` donne la raison de la règle, avec un exemple dans chaque sens :

```text
$ npx ddd-ts-kit explain context/published-language-only
context/published-language-only

A file imports from another context only through that context's published-language/.

Why: A bounded context owns its model and must be free to change it. The published language is the only part designed for others; importing anything else couples two models and turns every refactoring into a cross-team negotiation.

Bad:
    // contexts/shipping/application/...
    import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';

Good:
    // contexts/shipping/application/...
    import type { InvoiceIssuedV1 } from '@/contexts/billing/published-language/index';

Suppress one line (with a reason): // ddd-ts-kit-disable-next-line context/published-language-only -- <reason>
```

La dernière ligne est la désactivation que le *checker* accepte ; s'en servir est une dérogation,
qui demande l'accord du propriétaire et un enregistrement de décision (la dernière ligne du
tableau ci-dessus).

## Référence

Chaque commande et chaque option, telles que `npx ddd-ts-kit --help` les affiche. Un test de la
CLI échoue quand une commande ou une option est ajoutée sans que cette partie soit régénérée.

<!-- ddd-ts-kit:commands -->
<!-- Generated from the help of the CLI: `npm run build`, then `node pipeline/monorepo/commands-guide.mjs`. -->

```text
Usage
  ddd-ts-kit init [--http express|fastify|hono|nest|none]
                  [--validation zod|class-validator|typebox|standard-schema|none]
                  [--di tsyringe|nest|manual] [--tests vitest|jest]
                  [--orm drizzle|knex|prisma|typeorm|custom|none] [--database postgres|mysql|sqlite|none]
                  [--events in-memory|outbox] [--docs-ui swagger|scalar|redoc|none]
                  [--ci github|gitlab|both|none] [--ci-extras <extra>,...|none]
                  [--authn jwt|keycloak|none] [--authz rbac|abac|rebac|custom]
                  [--broker none|rabbitmq|kafka|nats|redis|custom] [--cache none|redis] [--http-cache none|varnish]
                  [--storage local|s3|none]
                  [--audit on|off]
                  [--errors none|sentry] [--logger stdout|pino|winston] [--style declared|explicit] [--assembly barrel|discovery]
                  [--dependencies signature|listed] [--refusals factories|classes]
                  [--routes controllers|functions] [--representations negotiated|json] [--forms on|off]
                  [--value-objects throwing|result] [--literals named|free] [--values classes|free] [--tenancy none|shared-table] [--queue database|redis|memory]
                  [--schemas shared|per-route]
                  [--package-manager npm|pnpm] [--allow-no-outbox "<reason>"] [--import-alias '$<name>/']
                  [--import-extension none|js] [--sdk]
                  [--context <name>:<core|supporting|generic>]... [--preset identity]... [--dry-run] [--force]
  ddd-ts-kit generate <kind> ... [--term "<Term>=<meaning>"]... [--allow-name] [--local-only] [--dry-run] [--force]     (alias: g)
  ddd-ts-kit generate --help --json
  ddd-ts-kit list [--context <name>]
  ddd-ts-kit describe <context>
  ddd-ts-kit status
  ddd-ts-kit todo [<context>]
  ddd-ts-kit worker-scope <context> [--base <ref>] [--rows <id,...>] [--worktree <path>] [--branch <name>] [--dry-run]
  ddd-ts-kit verify-slice <context> --since <git-ref>
  ddd-ts-kit docs [--check] [--stored-events]
  ddd-ts-kit sdk [--check] [--dry-run]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit build-aliases [--project <tsconfig>]
  ddd-ts-kit drizzle-generate --name <what-it-does> [--custom]
  ddd-ts-kit error-factories --plan | --apply [--dry-run]
  ddd-ts-kit controllers [<context>] [--dry-run]
  ddd-ts-kit value-objects [--dry-run]
  ddd-ts-kit affected [--base <git-ref>] [--head <git-ref>] [--format text|json|github|env]
  ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab] [--changed-since <git-ref>] [--self]
  ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
  ddd-ts-kit check --commit-size [--staged] [--strict]
  ddd-ts-kit check-file <path>
  ddd-ts-kit rules
  ddd-ts-kit explain <rule-id>

Every command accepts --json (machine-readable output) and --cwd <dir> (project root).

  affected         what a pull request has to run: the contexts a change set reaches through the context
                   map (a changed context and the contexts downstream of it), as filters for the test
                   runner and the linter; everything when a shared path changed or without --base
  build-aliases    after the compiler: rewrites the import aliases left in the emitted .js and .d.ts files
                   into relative paths, so that plain node runs the output (tsconfig.build.json by default)
  drizzle-generate the db:generate of a Drizzle project: drizzle-kit generate --name, which without a terminal
                   fails and names the fix when drizzle-kit would ask whether a column or table is renamed,
                   where drizzle-kit alone writes nothing and exits 0
  error-factories  moves a project from one class per error to static factories on one error class per
                   concept: --plan writes error-factories.plan.json, where each class is given its concept;
                   --apply follows it (classes, specs, every usage, "stack.refusals" in the config)
  value-objects    moves the value objects of a project from a Result to factories that return the value or
                   throw: every create returning Result<T, E> returns T, err(..) is thrown, unwrap(..) of
                   them goes, specs assert expectRefusal(() => ..), "stack.valueObjects" becomes throwing
  controllers      moves the function routes of a project, or of one context, to controller classes: each
                   <name>.route.ts becomes <resource>/<name>/<name>.controller.ts behind the route group of
                   its resource, its schema files and its spec follow; a context is turned whole or not at all
  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, and the TODO(domain), TODO(platform), it.todo and TODO(review) left in
                   each context
  sdk              the typed client of each document of the contract, a workspace package under
                   clients/<document> without runtime dependency: typed errors keyed by the error codes,
                   credentials per security scheme; records "sdk" in the config the first time, wires the
                   scripts (docs:generate regenerates it, docs:check compares it, ci:build builds it);
                   --check writes nothing and exits 1 while a client differs from its contract
  todo             those markers as file:line, in the project or in one context
  worker-scope     a git worktree on the branch build/<context> (by default ../<project>-<context>), cut from
                   --base <ref> (by default the current branch, refused from a worker's worktree), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context; --rows <id,...>
                   briefs those rows of slices.md only, with their rules; an existing worktree or branch
                   that does not contain the base is refused
  verify-slice     closes a slice before its commit, in one run: the regenerate script, check on the files
                   changed since --since (new ones included), the test script for the context; then the
                   changed files past 300 of the 350 lines, and the paths to stage; exits 1 while a step fails
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --stored-events  docs records the shape of each version of the stored events in stored-events.lock.json,
                   never rewriting a recorded one: run it once the shape of a version is the one to store;
                   docs --check fails while a declared version is not recorded
  --sdk            init records "sdk" in the config and generates the clients with the project
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do

Kinds
  context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]... [--preset identity]
  aggregate <context> <Name> [--event-sourced] [--term "<Term>=<meaning>"]...
  builder <context> <Aggregate>
  entity <context> <Name> [--term "<Term>=<meaning>"]...
  value-object <context> <Name> [--term "<Term>=<meaning>"]...   (alias: vo)
  vocabulary <context> <Name> --value <value> [--value <value>]...
  state-machine <context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]... [--term "<Term>=<meaning>"]...
  domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...
  error <context> <Concept> <refusal> [--code CODE] [--term "<Term>=<meaning>"]...   (alias: refusal)
  domain-error <context> <Name> [--code CODE]
  domain-service <context> <Name> [--term "<Term>=<meaning>"]...
  repository <context> <Aggregate> [--tenant-scoped]
  command <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--aggregate <Name>] [--term "<Term>=<meaning>"]...
  query <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--search] [--term "<Term>=<meaning>"]...
  port <context> <Name>
  route <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer] [--cache public|private|no-store]
  controller <context> <UseCaseName> --method <GET|POST|PUT|PATCH|DELETE> --path <path> [--command|--query] [--group <Name>] [--mapper] [--serializer] [--cache public|private|no-store]
  file-upload <context> <UseCaseName> --path <path> (--permission <aggregate>.<action> [--grant <role>] | --public) [--method <POST|PUT>] [--group <Name>]
  route-group <context> <Name> [--prefix <path>] [--group <ParentName>] [--public | --role <role>]   (alias: group)
  guard <context> <Name>
  representation <context> <UseCase> <xml|csv|media/type>[,...]
  form <context> <UseCase>
  schema <context|shared-kernel> <Name>
  integration-event <context> <Aggregate> <Fact> [--version <n>] [--term "<Term>=<meaning>"]...
  integration-handler <context> <upstreamContext> <eventType> [--name <Name>] [--term "<Term>=<meaning>"]...   (alias: consumer)
  event-handler <context> <Aggregate> <Fact> [--phase before-commit|after-commit] [--name <Name>] [--term "<Term>=<meaning>"]...
  projection <context> <Name> <eventType> [--term "<Term>=<meaning>"]...   (alias: projector)
  job <context> <Name> (--every <duration> | --cron "<expression>" [--time-zone <zone>]) --command <UseCaseName> [--term "<Term>=<meaning>"]...
  background-job <context> <Name> --command <UseCaseName> [--term "<Term>=<meaning>"]...
  process <context> <Name> [--term "<Term>=<meaning>"]...   (alias: process-manager)
  acl <context> <upstreamOrSystemName>
  e2e <context> <UseCaseName>
  policy <context> <Name> --permission <aggregate>.<action>
  gateway <context> <upstreamContext> <Name>
  adapter <context> <Port> [--kind external|gateway] [--decorators]
  service <context>
  worker
  adr "<title>" [--number <n>] [--deviation <what>] [--reason "<why>"]
```
<!-- /ddd-ts-kit:commands -->

## Voir aussi

- [Méthodologie](methodology.fr.md) : le chemin, étape par étape, avec ce que laisse chaque étape
  et quand elle est finie
- [README de la CLI](../../packages/cli/README.fr.md) : chaque commande en détail
- [Configuration](../CONFIG.fr.md)
