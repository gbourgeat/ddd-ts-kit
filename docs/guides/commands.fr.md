[English](commands.md) · **Français**
<!-- translation-of: commands.md sha256:410681d147a9e950 -->

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
| `/ddd-ts-kit:story <code> [<énoncé>]` | une *user story* de ses questions à une *pull request* verte, dans son propre *worktree* : les questions d'abord, puis spécification, lignes, revue de conception, acceptation, construction, revue, rapport ([parcours d'une story](story-workflow.fr.md)) | une fois le projet amorcé, un terminal par *story* | la *pull request* de la *story* et son rapport | relire le rapport, valider chaque décision provisoire |
| `npx ddd-ts-kit story-scope <code>` | le *worktree* d'une *story* sur `story/<code>`, son `.ddd-ts-kit/story.json` et son installation ; les autres *stories* ouvertes et leurs contextes | la première étape de la *skill* story | `.worktrees/<code>` | `npx ddd-ts-kit story <code>` |
| `npx ddd-ts-kit stories` | les *stories* ouvertes dans les *worktrees* du dépôt et où deux d'entre elles se croisent : les contextes que les deux nomment, les fichiers que les deux changent, ce que la fusion de l'une dans l'autre laisse à régler à la main, le retard de chacune sur son tronc | avant de découper les lignes d'une *story* et avant chaque ligne, après `git fetch` | un texte court, `--json` pour des données ; code de sortie 0 | se tenir à l'écart de ce qu'une autre *story* change, ou consigner laquelle arrive la première |
| `npx ddd-ts-kit worktree <name>` | le *worktree* de tout travail qui n'est ni une *story* ni un *worker* : `.worktrees/<name>` sur `work/<name>` coupé de `origin/main`, installé | avant d'écrire le code d'un contexte depuis le *checkout* principal du tronc, que la garde refuse dans un projet créé par `init` | le *worktree*, sa branche et son installation | y travailler, *commiter*, ouvrir sa *pull request* |
| `npx ddd-ts-kit story [<code>] [--gate build\|close]` | les phases d'une *story* et l'étape suivante ; `build` ouvre son code, `close` sa *pull request* | à tout moment dans le *worktree* d'une *story* | un texte court, `--json` pour des données ; code de sortie 1 tant que la barrière n'est pas franchie | faire l'étape suivante |
| `/ddd-ts-kit:plan-slices` | le travail en tranches verticales, ordonnées, avec leurs commandes de générateur | étape 6, après l'amorçage | `docs/architecture/slices.md` | `/ddd-ts-kit:use-case` |
| `npx ddd-ts-kit cited --rows <id> --base origin/main` | les noms que la conception d'une ligne cite comme du code et que le tronc n'a pas : retirés par son historique (avec le commit et ce qui les remplace), refusés par l'arborescence canonique, ou proches d'un nom qu'il a gagné depuis que la ligne a été écrite ; un nom prévu reste muet | avant de construire seul une ligne, avant de committer une revue de conception | une ligne par nom, `--json` pour les données ; code de sortie 0 | construire sur ce que le tronc a, et corriger le document sur le tronc |
| `npx ddd-ts-kit generate acceptance <story>`, puis `npx ddd-ts-kit acceptance <story> --lock` | la *spec* d'acceptation d'une *story*, un `it.todo` par critère de `docs/architecture/stories/<story>.md`, à écrire en scénarios enveloppés dans `pending(...)` ; le verrou les enregistre, après quoi un scénario ne change qu'avec son critère, et un critère ou un scénario dont les critères n'ont pas changé seulement avec un verdict de l'agent `acceptance-judge` | avant la première ligne de code d'une *story* | `test/acceptance/<story>.acceptance.spec.ts` et son `.lock.json` | `npx ddd-ts-kit acceptance <story> --gate written`, puis les lignes |
| `npx ddd-ts-kit acceptance [<story>] [--gate written\|passing]` | les scénarios de chaque *story* face à ses lignes et à ses critères : à écrire, en attente, dérivés du verrou, incohérents, et les amendements à valider | avant le code d'une *story* (`written`), avant de la clore (`passing`) | un texte court, `--json` pour des données ; code de sortie 1 tant que la barrière demandée n'est pas franchie | écrire, verrouiller, construire, ou signaler les amendements |
| `/ddd-ts-kit:use-case <UseCase>` | une tranche de bout en bout, test d'abord | pour chaque ligne des tranches | domaine, gestionnaire, route et *specs*, remplis | `npm run verify` |
| `npx ddd-ts-kit generate <kind> ...` | un fichier d'un rôle avec sa *spec*, son *fake* et son enregistrement (liste ci-dessous) | chaque fois qu'il faut un fichier d'un rôle, jamais à la main | le fichier et les endroits `TODO(domain)`, `--json` pour la liste | remplir les endroits, puis `todo` |
| `npx ddd-ts-kit todo [<context>]` | chaque `TODO(domain)`, `TODO(platform)`, `it.todo` et `TODO(review)` restant | avant de clore une tranche, une story ou un jalon | des entrées `file:line` | les écrire, puis `npm test` ; régler chaque `TODO(review)` ou l'écarter par `generate adr` avant de clore la story ou le jalon |
| `npx ddd-ts-kit story-check <code> [--strict]` | si une story ou un jalon (`M1` pour les lignes `M1.*`) peut être clos : chaque ligne `done`, aucun marqueur qui lui appartient, un marqueur lui appartenant quand son texte, le *commit* qui l'a écrit ou le *worker* qui le porte nomme une de ses lignes, ou quand il n'appartient à aucune ligne dans un contexte où aucune autre story ouverte ne travaille | avant de déclarer clos une story ou un jalon ; `status` nomme celui dont les lignes sont faites mais que des marqueurs gardent ouvert | une ligne quand il peut être clos ; sinon chaque marqueur bloquant avec la raison pour laquelle il est à lui, son `file:line` et sa correction, puis les marqueurs non attribués listés sans bloquer ; sort avec 0, 1, ou 2 sur un code inconnu | traiter chaque marqueur bloquant ou l'écarter par `generate adr`, puis supprimer le marqueur ; nommer la ligne dans un marqueur non attribué (`TODO(review): #M1.03 ...`) |
| `/ddd-ts-kit:parallel-work` | répartit les tranches entre des *workers*, un contexte chacun | quand plusieurs agents ou personnes construisent en même temps | une consigne par *worker*, des *worktrees* `npx ddd-ts-kit worker-scope <context>`, avec les documents de la conception de chaque ligne et les noms qu'ils citent que le tronc n'a pas | le `use-case` de chaque *worker* |
| `npx ddd-ts-kit status --workers` | le *worktree*, la branche, le contexte, les lignes et l'avance de chaque *worker*, son état (lignes commitées, ligne en cours, dernier verify-slice), les fichiers qu'il a changés, et ceux que deux *workers* changent | avant de confier une consigne à un second *worker* dans un contexte, avant chaque fusion | un texte court, `--json` pour des données | d'autres lignes pour le nouveau *worker*, l'ordre des fusions, ou `--resume` pour un *worker* arrêté |
| `npx ddd-ts-kit worker-scope <context> --resume` | où en est un *worker* arrêté (lignes d'après leur *trailer* `Slice:`, fichiers de la ligne en cours, marqueurs, dernier verify-slice, rapport, agent), lu sans rien changer | sur une notification d'arrêt d'un `context-builder` (limite de tours, erreur, une personne) | le texte du SendMessage pour son agent, ou la consigne d'un nouvel agent | l'envoyer tel quel |

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
| `npx ddd-ts-kit verify-slice <context> --since <ref>` | en une passe : `npm run regenerate`, les règles d'architecture sur les fichiers modifiés depuis la référence (nouveaux compris), les tests du contexte, les fusions depuis la référence (contrôlées comme le fait `verify-merge`, signalées sans faire échouer la tranche dans cette version), les fichiers modifiés proches de la limite de 350 lignes | avant le commit d'une tranche, à relancer jusqu'à ce qu'elle passe | chaque étape avec sa cause, puis les chemins de la tranche à indexer, tout autre chemin modifié, laissé de côté et jamais indexé avec elle, et les noms que la tranche retire et que la conception d'une ligne non terminée cite encore (jamais un échec) | le commit de la tranche, des seuls chemins qu'elle liste à indexer ; ces noms vont au chef d'orchestre, en notes |
| `npx ddd-ts-kit check --changed-since <ref>` | les règles d'architecture sur ce qui a changé | pendant l'itération | des violations avec leur correction, puis, avec `--explain`, la raison de chaque règle signalée, une fois | `npx ddd-ts-kit explain <rule-id>` quand l'une n'est pas claire |
| `npm run regenerate` (`npx ddd-ts-kit depcruise-config --write`, puis `npm run docs:generate`, qui lance `npx ddd-ts-kit docs`) | régénère tous les fichiers dérivés : `.dependency-cruiser.cjs`, la carte des contextes, les listes des `CONTEXT.md`, les *barrels* et les contrats | après un changement d'une route, d'un schéma, d'un événement ou de la configuration | les fichiers générés, commités avec le code | `/ddd-ts-kit:commit-discipline` |
| `/ddd-ts-kit:commit-discipline`, `npx ddd-ts-kit check --commit-size --staged` | une tranche par *commit*, sa taille comparée à la configuration | avant `git commit` (le *hook* lance le contrôle) | un message `<type>(<context>): ...` | la tranche suivante |

## Avant une pull request

| Commande ou *skill* | Fait | Quand | Produit | Ensuite |
|---|---|---|---|---|
| `/ddd-ts-kit:quality-gate`, `npm run verify` | chaque porte du *pipeline*, corrigée à la racine | avant d'ouvrir la *pull request* ou la *merge request* | une porte verte | la *request* |
| `npx ddd-ts-kit merge-trunk` | apporte le tronc dans la branche en un seul *commit* de fusion calculé à partir du *diff* propre de la branche (depuis l'endroit où elle est arrivée après un *squash*) : fichiers dérivés, régions et registres générés, lignes de `slices.md`, méta de drizzle, fichier de verrouillage et verrou des événements stockés réglés, migrations rejouées (renommées avec `--to-land`), décisions renumérotées, régénération, puis `verify-merge` sur le résultat | un *worker* : pour apporter le tronc, jamais `git merge` seul ; le chef d'orchestre : `--to-land --cwd <worktree>` juste avant la fusion en *squash* | un *commit* de fusion avec les *trailers* `Merge-Base:`, `Trunk:` et `Landed:` ; ou une fusion en cours avec chaque bloc laissé, ce que chaque côté y a fait, code de sortie 1 | résoudre chaque bloc, `git add`, `merge-trunk --continue` (`--accept-lost` pour une suppression voulue, `--abort` pour défaire), puis `npm run verify` |
| `npx ddd-ts-kit verify-merge` | ce que les fusions de la branche ont perdu, lu dans git seul : une ligne ajoutée par un côté, une tranche terminée, un test, une *spec*, une migration, un marqueur de conflit | merge-trunk la lance avant son *commit* ; après une fusion faite autrement, ou un *squash* avec `--theirs <head>` ; le *hook* de *pre-push* (`--warn`) et `verify-slice` la lancent aussi, en avertissement dans cette version : une version mineure ultérieure bloquera | les constats de chaque fusion, avec `file:line` et le côté qui les portait ; rien sans fusion ; code de sortie 1 sur une erreur, 0 avec `--warn` | rétablir chacun depuis son côté, ou consigner une suppression voulue par un *trailer* `Lost-Accepted: <file:line>` |
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
| `npx ddd-ts-kit init --force` | réécrit les fichiers que possède `init`, garde la configuration, y inscrit sa version en `initVersion` et recâble les contextes | après la mise à jour | les fichiers de plateforme et de *pipeline* de la nouvelle version, et des notes | `npm run verify` |
| `npx ddd-ts-kit controllers`, `error-factories --plan` puis `--apply`, `value-objects` | déplace les routes en fonctions vers des contrôleurs, les classes d'erreur vers des fabriques, les objets-valeurs d'un `Result` vers des fabriques qui lèvent une erreur | quand le projet adopte ces formes | les fichiers réécrits et la clé de configuration | `npx ddd-ts-kit docs`, `npm run verify` |
| `npx ddd-ts-kit platform-folders [--place <file>=<folder>]... [--dry-run]` | déplace les fichiers de `src/platform/auth/` qu'un projet a générés à plat vers `authentication/`, `authorization/` et le dossier du modèle, avec chaque import qui les nomme | quand `doctor` signale `folder src/platform/auth: flat` ; les générateurs et `init --force` gardent le rangement à plat jusque-là | les fichiers déplacés, les imports réécrits, les fichiers de l'équipe laissés à plat | `npm run format`, `npm run verify` |
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
                  [--dependencies signature|listed] [--refusals named|factories|classes]
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
  ddd-ts-kit status [--workers]
  ddd-ts-kit doctor [--strict]
  ddd-ts-kit todo [<context>]
  ddd-ts-kit plan-waves [<context>]
  ddd-ts-kit story-check <code> [--strict]
  ddd-ts-kit acceptance [<story>] [--gate written|passing] [--lock]
  ddd-ts-kit worker-scope <context> [--base <ref>] [--rows <id,...>] [--worktree <path>] [--branch <name>] [--no-install] [--dry-run]
  ddd-ts-kit worker-scope <context> --resume [--worktree <path> | --branch <name>] [--fresh]
  ddd-ts-kit worker-scope <context> --here [--rows <id,...>] [--base <ref>] [--dry-run]
  ddd-ts-kit story-scope <story> [--base <ref>] [--worktree <path>] [--branch <name>] [--no-install] [--dry-run]
  ddd-ts-kit story [<story>] [--gate build|close]
  ddd-ts-kit stories
  ddd-ts-kit worktree <name> [--base <ref>] [--branch <name>] [--no-install] [--dry-run]
  ddd-ts-kit verify-slice <context> --since <git-ref>
  ddd-ts-kit cited [<context>] [--rows <id,...>] [--base <ref>] [--removed-since <ref>]
  ddd-ts-kit verify-merge [<commit>] [--since <git-ref>] [--theirs <git-ref>] [--base <commit>] [--warn]
  ddd-ts-kit merge-trunk [--trunk <git-ref>] [--since <commit>] [--to-land] [--dry-run]
  ddd-ts-kit merge-trunk --continue [--accept-lost] | --abort
  ddd-ts-kit docs [--check] [--stored-events]
  ddd-ts-kit sdk [--check] [--dry-run]
  ddd-ts-kit depcruise-config [--check|--write]
  ddd-ts-kit build-aliases [--project <tsconfig>]
  ddd-ts-kit drizzle-generate --name <what-it-does> [--custom]
  ddd-ts-kit drizzle-generate --replay [--base <git-ref>]
  ddd-ts-kit error-factories --plan | --apply [--to named|factories] [--dry-run]
  ddd-ts-kit controllers [<context>] [--dry-run]
  ddd-ts-kit value-objects [--dry-run]
  ddd-ts-kit platform-folders [--place <file>=<folder>]... [--dry-run]
  ddd-ts-kit affected [--base <git-ref>] [--head <git-ref>] [--format text|json|github|env]
  ddd-ts-kit affected --base <git-ref> --run <script>
  ddd-ts-kit check [paths...] [--rule <id>]... [--format text|json|github|gitlab] [--changed-since <git-ref>] [--explain] [--self]
  ddd-ts-kit check --clean-only <dir>... [--rule <id>]... [--format text|json|github]
  ddd-ts-kit check --commit-size [--staged] [--strict]
  ddd-ts-kit check-file <path>
  ddd-ts-kit lint [paths...] [--format <eslint formatter>] [--fix]
  ddd-ts-kit rules
  ddd-ts-kit explain <rule-id>

Every command accepts --json (machine-readable output) and --cwd <dir> (project root).

  affected         what a pull request has to run: the contexts a change set reaches through the context
                   map (a changed context and the contexts downstream of it), as filters for the test
                   runner and the linter; everything when a shared path changed or without --base;
                   --run <script> runs that script of the project on them (DDD_TS_KIT_AFFECTED set,
                   --passWithNoTests on a partial run) and nothing when nothing that runs changed:
                   the pre-push hook tests the contexts its branch reaches
  build-aliases    after the compiler: rewrites the import aliases left in the emitted .js and .d.ts files
                   into relative paths, so that plain node runs the output (tsconfig.build.json by default)
  drizzle-generate the db:generate of a Drizzle project: drizzle-kit generate --name, which without a terminal
                   fails and names the fix when drizzle-kit would ask whether a column or table is renamed,
                   where drizzle-kit alone writes nothing and exits 0; then formats the snapshot and the
                   journal it wrote with the Biome or Prettier of the format script, and warns when the
                   SQL changes a primary key in an order that fails on PostgreSQL (exit code unchanged);
                   --replay, after merging the trunk into a branch when both added migrations: when the
                   history forks from --base <ref> (origin/main by default), deletes the migrations of the
                   branch the base does not have, with their snapshots and journal entries, then generates
                   each again on top, in order, under its name (working- dropped outside a worker's
                   worktree, a custom one keeping its SQL); when it does not fork, only renames them;
                   refused while the journal holds conflict markers, when two of them change the schema,
                   or when drizzle-kit now writes a generated one otherwise (edited by hand), the folder
                   then put back as it was
  error-factories  moves the refusals of a project to one class per refusal (--to named, the default), from
                   one class per error or from the factories of one error class per concept: --plan writes
                   error-factories.plan.json, where each refusal is given a class (the PascalCase of its
                   code, which it keeps) and a factory (for<Concept>), both editable; --apply follows it
                   (codes.ts per context, one class file per refusal, specs, every usage, the concept
                   classes left empty, "stack.refusals" in the config) and lists what it cannot rewrite
                   (a bare <Concept>Error.is(error), CodeOf<typeof <Concept>Error>); --to factories moves
                   one class per error to static factories on one error class per concept instead
  value-objects    moves the value objects of a project from a Result to factories that return the value or
                   throw: every create returning Result<T, E> returns T, err(..) is thrown, unwrap(..) of
                   them goes, specs assert expectRefusal(() => ..), "stack.valueObjects" becomes throwing
  platform-folders takes the files of the platform a project generated flat to their folders: under
                   auth/, authentication/ (who is calling), authorization/ (what they may do, whatever the
                   model) and the folder of the model (roles/, attributes/, relationships/, custom/); every
                   import of them under the source root, test/ and scripts/ follows; a file the kit did not
                   write stays where it is, named, unless --place <file>=<folder> gives it its folder; the
                   generators read either layout until then
  controllers      moves the function routes of a project, or of one context, to controller classes: each
                   <name>.route.ts becomes <resource>/<name>/<name>.controller.ts behind the route group of
                   its resource, its schema files and its spec follow; a context is turned whole or not at all
  doctor           what an upgrade left to do: the scripts, the packages of the kit (at the ranges of this
                   version) and the agent permissions this version writes that the project lacks or writes
                   otherwise, and the git hooks (the lefthook: line of lefthook.yml, the pre-commit hook of
                   lefthook in this clone); init adds what is missing, hooks:install the hook; then what
                   this checkout lacks to run the project, read without network: the running Node against
                   engines.node and .nvmrc, node_modules installed since the lockfile last changed, each
                   package of the kit installed at the version of this CLI, the submodules initialised;
                   each with its fix; --strict exits 1 while something is missing or the checkout cannot
                   run the project, never for a hook this clone has not installed, a Node .nvmrc does not
                   name or a lockfile changed since the install
  lint             the ESLint of the project (lint and ci:lint run it): fails on an error, and on a warning
                   as on an error, but on one of a rule of the kit in transition, a new rule that becomes an
                   error in the version it names, whose warnings are listed apart; --format and --fix as ESLint
  describe         one context as facts: use cases, routes, events, ports, policies, gateways, dependencies
  status           the next step of docs/architecture/plan.md, the slices of docs/architecture/slices.md by
                   status and by owner, each row not done ready on the trunk (its dependencies done), ready
                   on a branch (the others briefed to a worker with commits ahead of its base) or waiting
                   (with the ids it waits for), a row that landed with a worker's branch but is not marked done,
                   and the TODO(domain), TODO(platform), it.todo and TODO(review) left in each context, and
                   each story or milestone whose rows are all done while markers of its own keep it open (see
                   story-check, whose git blame it runs on those markers only); --workers shows instead each
                   worktree holding .ddd-ts-kit/worker.json (branch, context, rows, base, commits ahead and
                   files changed counted from where its branch landed on the base when it was squash-merged
                   there (else from the merge base), commits behind, the commit it landed as, what merge-trunk
                   would leave conflicted now, dependencies not installed, its report), a state line (rows
                   committed, the row under way, files uncommitted, markers, last verify-slice, and the
                   worker-scope --resume command of a stopped one), then the contexts and the files more than
                   one worker holds
  sdk              the typed client of each document of the contract, a workspace package under
                   clients/<document> without runtime dependency: typed errors keyed by the error codes,
                   credentials per security scheme; records "sdk" in the config the first time, wires the
                   scripts (docs:generate regenerates it, docs:check compares it, ci:build builds it);
                   --check writes nothing and exits 1 while a client differs from its contract
  todo             those markers as file:line, in the project or in one context
  plan-waves       the rows of slices.md not done, of the project or of one context, in waves (wave 1: every
                   dependency done; wave n: the others in earlier waves), each wave cut into batches of one
                   owner, one or two rows on one aggregate, with the worker-scope command that briefs each,
                   the batches of a wave likely to touch the same files (same aggregate in Start with, or
                   unknown when it names none), the merge order and what runs before each merge (merge-trunk
                   --to-land); a cycle, a dependency on an unknown id or a row without owner is reported
                   alone, and exits 1
  story-check      whether a story or a milestone can close, <code> being the start of the ids of its rows
                   (M1 for M1.01, M1.02: the id without its last .<number>): every row of it done in
                   slices.md (the others listed with their status), and no marker of its own left
                   (TODO(domain), TODO(platform), it.todo, TODO(review)). A marker is attributed to
                   rows: those its text names (#M1.03 or M1.03, word-bounded), else those of the commit
                   that wrote its line (git blame, once per file; its Slice: trailer, else the row ids
                   its message names), else, not committed, those of .ddd-ts-kit/worker.json in a
                   worker's worktree. It is the story's own when it belongs to one of its rows,
                   wherever it is; a marker of a context of its rows that belongs to no row is its own
                   when no other open story has a row in that context, and is listed without blocking
                   otherwise (settle it or name its row in it); a marker of other stories' rows does not
                   block. --strict: every marker of its contexts blocks. Each blocker comes with why it
                   is its own, its file:line and its fix: handle it, or dismiss it by a decision record
                   (generate adr), then delete the marker. Reads only: exits 0 when it can close, 1
                   listing what keeps it open, 2 on a code no row carries or without slices.md
  acceptance       the acceptance scenarios of each story (test/acceptance/<story>.acceptance.spec.ts) against
                   its rows in slices.md and the criteria of docs/architecture/stories/<story>.md: the rows and
                   criteria each scenario names (#US5.02 AC1 in its title), the scenarios left to write
                   (it.todo), those wrapped in pending(...) of @ddd-ts-kit/testing/e2e until their code is
                   built, and what is inconsistent (no row, an unknown row or criterion, a scenario skipped,
                   a pending one whose rows are done, a locked one changed while its criteria were not);
                   --gate written: every slice row and criterion has a written scenario, none is left to
                   write, the acceptance is locked (before the code of the story); --gate passing: none is
                   pending either (before the story closes); exits 1 while a gate is not met, or, without
                   one, on an inconsistency. Never runs a test. --lock writes
                   test/acceptance/<story>.acceptance.lock.json, the fingerprint of each criterion and of
                   each scenario (pending(...), layout and comments aside), refused while a scenario is
                   left to write, or while a criterion changed, or a locked scenario changed while its
                   criteria did not, without a verdict "amend" of the acceptance-judge agent on that very
                   version (test/acceptance/verdicts/*.md, lines Story:, Subject:, Fingerprint:,
                   Verdict:, Reason:); a refusal wins; the verdicts become amendments of the lock,
                   listed for the owner to validate
  worker-scope     a git worktree on the branch build/<context> (by default .worktrees/<context>, see worktree),
                   cut from --base <ref> (by default the current branch, refused from a worker's worktree), its
                   .ddd-ts-kit/worker.json, and the briefing of the worker of that context; --rows <id,...>
                   briefs those rows of slices.md only, with their rules, the documents of their design and
                   the names that design cites the base does not have (see cited), and by default the first
                   batch plan-waves cuts for the context (one or two rows on one aggregate), a note naming the
                   next; a worktree it creates gets the clean install of the package manager (npm ci), its
                   time in the notes, unless --no-install; an existing worktree or branch that does not
                   contain the base is refused, with the merge-trunk that brings it in
  --here           worker-scope in the worktree of a story (.ddd-ts-kit/story.json): writes the scope of the
                   next agent in place, its base the base of the story, and prints its briefing; no
                   worktree, branch or install of its own; the agents of a story run one after the other
  story-scope      the worktree of one story, .worktrees/<story> on story/<story> cut from --base (by default
                   origin/main from the trunk, else the current branch, refused from the worktree of a
                   story), its .ddd-ts-kit/story.json and
                   its clean install; an existing one is kept and the story resumes there; refused when the
                   story is open in another worktree; names the other open stories and the contexts their
                   rows change
  worktree         the worktree of any other piece of work, .worktrees/<name> on work/<name> cut from --base
                   (by default origin/main from the trunk, else the current branch), and its clean install
                   unless --no-install; an existing one is kept; .worktrees/ lies in the main checkout,
                   whichever worktree it runs from, ignored by git and by the tools of the project; while
                   the .gitignore of a project started before does not hold it (init adds it), a worktree
                   opens next to the project, ../<project>-<name>; in a project whose config says
                   "worktrees": "required" (what init writes), the guard of the plugin refuses the code of
                   a context in the main checkout of the trunk, and in a worktree of .worktrees/ without
                   its own node_modules
  story            where a story stands, phase by phase: its specification and criteria
                   (docs/architecture/stories/<story>.md), its rows in slices.md, a design review section
                   per row not done (docs/architecture/reviews/<story>.md, ## #<id>), its acceptance written
                   and locked, its rows done, its acceptance passing, its trunk merged in, its ## Report; and
                   the next step; in the worktree of a story, the story is its own; --gate build exits 1
                   until the first four are met (the code may start: the guard of the plugin opens the
                   contexts), --gate close until all are
  stories          the stories open in the worktrees of the repository and where two of them meet: the
                   contexts the rows of both name, the files both worktrees change (committed or not), what
                   merging the branch of one into the other leaves to a person and what merge-trunk settles
                   (git merge-tree, nothing written); how far each is behind its base; from the worktree of a
                   story, the stories it meets; the guard of the plugin says it at session start and on a
                   write to a file another story changes
  --resume         worker-scope reads where the stopped worker of the context stands (its rows by their
                   Slice: trailer, the files of the row under way, the markers, its last verify-slice, its
                   report, its agent as the guard recorded it) and prints the message that resumes its agent
                   (SendMessage) or the briefing of a new one; creates and rewrites nothing; --fresh asks for
                   a new agent whatever the last one did; several worktrees of the context need --worktree
  verify-slice     closes a slice before its commit, in one run: the regenerate script, check on the files
                   changed since --since (new ones included), the test script for the context; then the
                   changed files past 300 of the 350 lines, the paths of the slice to stage (its context, an
                   end-to-end spec, a working migration, the derived files git tracks) and every other
                   changed path, left out and never to stage with it; the merges since --since, as
                   verify-merge checks them, reported without failing the slice in this version (a later
                   minor version fails it); exits 1 while a step fails; then the names the slice removes
                   that the design of a row not done still cites (never a failure); in the worktree of a
                   worker, the commit command with the trailer Slice: <row>, and
                   .ddd-ts-kit/verification.json for the conductor
  cited            the names the design of rows not done cites as code (paths, classes, Class.member) that
                   the code does not have: those the history of --base removed (with the commit and the
                   successor), the places the canonical tree refuses, and a name never there whose close
                   name of the same part arrived after the line was written; planned names stay silent.
                   The design of a row: its cells and rule lines in slices.md, a section of a document of
                   docs/architecture whose heading names it, a document that names it or that its rule
                   line links to. Default: every row not done, of the context when given, at the current
                   branch. --removed-since <ref>: the names a change removes, from the merge base to the
                   working tree, that such a design cites. Reads only, exits 0
  verify-merge     what the merges of a branch lost, read from git only: every merge commit since --since
                   (by default the base of .ddd-ts-kit/worker.json, then origin/HEAD, then origin/main) and
                   the merge in progress (its result: the index and the working tree), or one <commit>; a
                   squash commit takes --theirs <head of the branch it took in>. Errors: a line one side
                   added or both kept missing from the result (whitespace, a line laid out again, a move
                   to another file and imports merged into one statement aside), a file neither side
                   deleted gone from the result, a row of slices.md done on one side and no longer done or
                   gone, a test title or a spec file of one side gone, a migration of one side whose
                   description (name without number and working-) the result lacks, a conflict marker;
                   warnings: a line one side removed brought back, a line one side wrote where the other
                   changed the same lines or deleted the file (the merge chose), a line the merge replaced
                   by lines of its own. Derived files, files a tool says it wrote, migrations, lockfiles
                   and slices.md are left out of the lines. The base is --base, else the Merge-Base:
                   trailer of the merge, else git merge-base; entries of a Lost-Accepted: <file:line>,...
                   trailer are listed and never fail, nor what a later commit restored; silent and exit 0
                   without a merge, exit 1 on an error; --warn prints the same and exits 0, as the
                   pre-push hook of init runs it in this version (a later minor version blocks the push)
  merge-trunk      brings the trunk (--trunk, by default origin/HEAD then origin/main, never fetched) into the
                   branch as one merge commit computed from the branch's own diff: from the newest commit of
                   the branch the trunk holds (--since; else the commit whose patch, derived files,
                   migrations, slices.md, plan.md and lockfiles left out, is one commit of the trunk, on this
                   branch or a branch it shares commits with; else the base recorded for the worker when its
                   lines are on the trunk; else git merge-base). Settles derived files and drizzle-kit meta
                   (trunk side), generated regions of CONTEXT.md and the context map (trunk side), conflicts
                   inside generated registries (lines of both sides), slices.md row by row (the furthest
                   status), the stored-events lock by key, the lockfile (trunk side, installed again when
                   the branch changed package.json); the rest is left in a merge in progress git
                   understands, with what each side did (exit 1). Then, or on --continue: the drizzle
                   migrations of both sides replayed, on --to-land the working migrations renamed (knex,
                   Prisma, TypeORM; stop when both sides change one table), decision records renumbered,
                   regenerate, verify-merge on the uncommitted result (an error stops; --accept-lost records
                   a Lost-Accepted: trailer), and the commit of the merge's paths only, with the trailers
                   Merge-Base:, Trunk: and Landed:; any other changed path blocks it. --dry-run previews,
                   --abort undoes; refused (exit 2) on a dirty tree, another operation in progress, no
                   committer known to git, an unknown trunk, or a git older than 2.40 with a base git
                   would not compute
  --commit-size    the files and lines about to be committed against "commit" in the config (20 files and
                   600 lines by default, generated files not counted); --staged reads the index only;
                   advisory, --strict exits 1 when over
  --explain        check follows the violations with the reason of each rule they report, once per rule, as
                   explain gives it without its examples ("explanations" in JSON); with github and gitlab, each
                   annotation carries the reason of its rule, a pull request showing an annotation on its own
  --stored-events  docs records the shape of each version of the stored events in stored-events.lock.json,
                   never rewriting a recorded one but one recorded by 0.82.0 or earlier, recorded again as
                   the kit reads it now: run it once the shape of a version is the one to store; docs --check
                   fails while a declared version is not recorded, or recorded by 0.82.0 or earlier
  --sdk            init records "sdk" in the config and generates the clients with the project
  --local-only     generate refuses, and writes nothing, when the kind would write outside its context;
                   "generate --help --json" says which kinds do

Kinds
  context <name> --classification <core|supporting|generic> [--purpose "<two sentences>"] [--term "<Term>=<meaning>"]... [--upstream <ctx>[:relationship]]... [--preset identity]
  aggregate <context> <Name> [--event-sourced] [--term "<Term>=<meaning>"]...
  builder <context> <Aggregate>
  test-world <context> [Name]
  entity <context> <Name> [--term "<Term>=<meaning>"]...
  value-object <context> <Name> [--term "<Term>=<meaning>"]...   (alias: vo)
  vocabulary <context> <Name> --value <value> [--value <value>]...
  state-machine <context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]... [--term "<Term>=<meaning>"]...
  domain-event <context> <Aggregate> <Fact> [--term "<Term>=<meaning>"]...
  error <context> <Refusal> <factory> [--code CODE] [--term "<Term>=<meaning>"]...   (alias: refusal)
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
  acceptance <story> ["<title>"]
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
