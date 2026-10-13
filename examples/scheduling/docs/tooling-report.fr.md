[English](tooling-report.md) · **Français**
<!-- translation-of: tooling-report.md sha256:c1ed2d7c71fc2478 -->

# Rapport sur l'outillage

Comment le kit s'est comporté pendant la construction de cet exemple, le 2026-10-10, par un chef
d'orchestre et sept *workers* qui suivaient les *skills* du *plugin*. Écrit pour le propriétaire
du kit : rien ici n'est arrondi en faveur du kit. Données brutes : `docs/tooling/generator-log.jsonl`
(une ligne par exécution d'un générateur), `node scripts/measure-tooling.mjs` (lignes générées
face aux lignes écrites à la main).

## Chiffres clés

| | |
|---|---|
| Durée réelle, de l'expression des besoins à une porte verte et une exécution réelle enregistrée | environ 1 h 25 min (de 06:33 à 07:58) |
| Exécutions de générateurs réussies | 213 (un `init`, 212 `generate`), 77 s de temps de générateur en tout |
| Exécutions de générateurs refusées | 27, presque toutes par la porte du glossaire |
| Fichiers de l'exemple | 831 |
| Fichiers écrits par un générateur et que personne n'a touchés | 133 (16 %) |
| Fichiers écrits par un générateur, puis remplis ou modifiés par un *worker* | 584 (70 %) |
| Fichiers écrits à la main | 106 (13 %), plus 8 documents dérivés |
| Lignes gardées des générateurs / lignes écrites à la main | 19 577 / 21 937 (2 917 lignes générées ont été retirées ou remplacées) |
| Marqueurs `TODO(domain)` écrits par les générateurs | 656, tous remplis |
| Entrées `it.todo` écrites par les générateurs | 317, toutes remplacées par des tests |
| Marqueurs `TODO(platform)` | 9 écrits, 4 restants (listés sous « Non construit ») |
| Tests | 1 288 tests unitaires et d'adaptateurs dans 226 fichiers, 57 tests de bout en bout dans 10 fichiers ; les 267 tests d'adaptateurs passent aussi sur PostgreSQL 18 |
| Construit | 32 commandes et requêtes, 25 routes, 2 politiques, 4 *jobs* planifiés, 5 projections, 14 événements d'intégration, 5 gestionnaires d'événements d'intégration, 2 *gateways* |
| Sous-agents | 7 (plateforme, identity, deux pour scheduling, notification, analytics, bout en bout), environ 2,0 millions de jetons à eux tous |
| Fichiers générés qui ont demandé une correction à la main pour un défaut ou un manque du kit | environ 40 (listés plus bas) |
| Défauts trouvés dans les *packages* du kit | 2 confirmés, avec reproductions |

Comment lire les nombres de lignes : les « lignes générées gardées » comprennent ce qu'écrit
`init` (configuration, les deux *pipelines*, le realm Keycloak : 6 500 lignes de fichiers du
projet) et les squelettes des *specs* générées ; « à la main » comprend environ 12 000 lignes de tests et 3 000 lignes de documents (ce rapport, le plan des *commits*, la transcription). Dans les quatre couches et le langage
publié des contextes, la répartition est de 4 600 lignes générées gardées contre 5 300 à la main :
les générateurs ont écrit la forme de chaque fichier et près de la moitié du texte. Les fichiers
qu'un générateur a écrits et qu'un *worker* a supprimés (les lecteurs de `query --list`,
friction 3) ne sont comptés nulle part.

## Durée réelle par phase

| Phase | Horloge | Qui | Notes |
|---|---|---|---|
| Lecture de la référence d'architecture, des *skills*, de quatre README de *packages* | de 06:33 à 06:35 | chef d'orchestre | environ 4 000 lignes lues avant d'écrire quoi que ce soit |
| Besoins, découverte, contextes, glossaire, carte des contextes | de 06:35 à 06:38 | chef d'orchestre | cinq artefacts |
| `init`, `npm install`, quatre contextes avec leurs 86 termes de glossaire | de 06:38 à 06:41 | chef d'orchestre | le projet nu a demandé cinq corrections à la main pour être vert dans ce *workspace* (frictions 7, 13) |
| Squelette et contrats : 8 agrégats et *repositories*, 14 événements d'intégration, 2 *gateways*, 2 politiques, 4 commandes avec leurs *jobs* | de 06:41 à 06:46 | chef d'orchestre | 50 exécutions de générateurs, *payloads* écrits à la main |
| Tranches, plan, consignes | de 06:46 à 06:49 | chef d'orchestre | |
| Plateforme : tuples persistants, schéma, autorisateur combiné, emprunt d'identité en lecture seule | de 06:46 à 06:55 | 1 *worker* | 157 k jetons |
| Contextes, en parallèle | de 06:49 à 07:23 | 5 *workers* | analytics 12 min (215 k jetons), notification 17 min (288 k), identity 19 min (284 k), calendriers de scheduling 26 min (352 k), rendez-vous de scheduling 32 min (455 k) |
| Intégration sur le tronc : liaisons, projections, statuts, enregistrement de décision | de 07:18 à 07:26 | chef d'orchestre | |
| Parcours entre contextes, et contournement du défaut des modèles de lecture | de 07:26 à 07:39 | 2 *workers* | 244 k et 20 k jetons |
| Exécution réelle : *stack* compose, jetons Keycloak, script de démonstration, trois passages | de 07:27 à 07:46 | chef d'orchestre | |
| Documents, mesures, plan des *commits* | de 07:46 à 07:58 | chef d'orchestre | |

## Exécutions des générateurs, par type

| Type | Exécutions | Sortie compilée et passée sans retouche par les analyseurs |
|---|---|---|
| `init` | 1 | non : un import inutilisé fait échouer le lint tant que le premier contexte n'existe pas ; `knip` signale `resilience/own-policy.ts` tant qu'aucun adaptateur ne l'utilise |
| `context` | 4 | oui |
| `aggregate`, `repository` | 8, 8 | oui ; le *fake* généré de chaque *repository* a dû être modifié plus tard (friction 6) |
| `integration-event` | 14 | oui, jusqu'à ce que le *payload* soit écrit : le *publisher* cesse alors de compiler tant qu'il n'est pas mappé (attendu, mais un contrat ne peut pas être commité seul et vert) |
| `gateway` | 2 | oui, jusqu'à ce que le contrat reçoive sa première méthode : le substitut `{}` lié dans les deux modules de la plateforme cesse de compiler (friction 5) |
| `policy` | 2 | oui |
| `command` | 26 | oui |
| `query` | 6 | les requêtes simples, oui ; pour les quatre exécutions `--list`, le port du lecteur, le lecteur en mémoire et le *fake* ont été supprimés (friction 3) |
| `route` | 24 | oui ; les paramètres de chemin n'ont pas reçu de DTO dans deux cas, des DTO de corps vides ont été générés dans trois |
| `job` | 4 | oui |
| `value-object`, `domain-error`, `domain-event`, `domain-service` | 20, 46, 8, 2 | oui |
| `event-handler` | 12 | oui |
| `integration-handler` | 5 | oui |
| `port` | 8 | oui |
| `adapter` | 3 | compilé ; deux sur trois ont été vidés de leur transport généré (friction 10) |
| `e2e` | 7 | compilé ; les sept ont été réécrits : la base générée suppose un rôle nommé `admin` et le tuple `context:<name>#operator` (friction 4) |
| `worker` | 1 | oui |
| `adr` | 2 | oui ; `--deviation` écrit l'entrée `deviations` mais pas l'entrée de configuration qu'elle justifie |

## Corrections à la main du code généré

| Fichiers | Quoi | Pourquoi |
|---|---|---|
| `package.json`, `scripts/tsc.mjs` | les scripts appellent le compilateur à travers un résolveur | les scripts générés nomment `node_modules/@typescript/native/bin/tsc` ; dans un *workspace* le *package* est remonté (hoisted), et il n'exporte aucun chemin vers son exécutable |
| `package.json`, `scripts/kit.mjs` | les scripts appellent la CLI avec `node` | défaut 2 plus bas |
| `.dependency-cruiser.workspace.mjs`, `package.json` | une configuration enveloppe avec `preserveSymlinks` | les *packages* liés se résolvent vers `../../packages/*`, donc chaque règle sur les *packages* autorisés se trompe (8 violations sur un projet vide) |
| `knip.json` | deux entrées | conséquences des deux lignes ci-dessus |
| `docker-compose.yml`, `.env.example` | nom du projet, liaisons sur l'interface de bouclage, ports inhabituels, étiquettes d'images locales | le fichier généré expose PostgreSQL, le cache et Keycloak sur toutes les interfaces à leurs ports par défaut, et nomme le projet d'après le répertoire |
| 12 fichiers de `src/platform/auth`, les deux modules de la plateforme, `compose-application.ts`, `test/e2e/support/start-application.ts` | le store de tuples est créé depuis la persistance et lié sous son port | le store généré est un singleton de module en mémoire derrière un `TODO(platform)` ; le rendre persistant oblige à recâbler chaque fichier qui l'importait (friction 4) |
| `platform.module.ts`, `platform-test.module.ts` | les deux contrats de lecture liés à des implémentations | friction 5 |
| `compose-application.ts` | cinq projections nommées dans les lignes `contextModule(...)` générées | friction 2 |
| `database/schema.ts` | `createAnalyticsTables` ajouté | aucun générateur de *repository* n'a tourné dans un contexte qui n'a que des modèles de lecture, donc rien n'a enregistré ses tables |
| `audit/list-audit-entries.route.ts` | `impersonatedBy` ajouté à la vue | la vue générée d'une entrée d'audit omet qui emprunte l'identité, ce que le journal enregistre |
| `observability/create-logger.ts` | une destination facultative | aucun moyen de lire les lignes de journal dans un test |
| 6 *fakes* de *repositories* | `snapshots` remplacé par un clone à travers `rehydrate` | friction 6 |
| 7 *specs* de bout en bout, 3 fichiers de *specs* générés | réécrits, ou découpés pour respecter `clean-stepdown` et le plafond de 100 lignes | friction 4 ; un `describe` généré dépasse le plafond une fois ses entrées `it.todo` remplies |
| 2 adaptateurs | transport, nouvelle tentative et délai d'expiration générés retirés | friction 10 |

## Écrit à la main là où un générateur serait plausible

- Cinq projections, leurs cinq adaptateurs `KnexReadModelStore`, tables, *fakes* et *specs*
  (friction 2).
- Les requêtes de liste autour de `Criteria`, `scoped` et `criteriaQuerySchema` (friction 3).
- Les implémentations des deux contrats de lecture du côté amont (friction 5).
- La table des statuts d'erreur (`src/platform/http/error-statuses.ts`) : `domain-error` prend
  un `--code` et rien ne dit quel statut il renvoie ; tout est 422 jusqu'à ce que quelqu'un s'en
  aperçoive.
- Le schéma des relations, la correspondance des permissions et la ressource de chaque
  `@Requires`.
- Les DTO de paramètres de chemin de deux routes ; les DTO imbriqués.

## Frictions, classées par ce qu'elles ont coûté

1. **Un modèle de lecture écrit par l'adaptateur Knex échoue à sa deuxième écriture avec une
   vraie horloge** (défaut 1 plus bas). Chaque *spec* de gestionnaire passait ; la première
   requête HTTP à travers l'application composée a répondu `422 CONCURRENCY_CONFLICT`. Coût :
   le seul état rouge de la construction qui a demandé un diagnostic, deux agents, un
   contournement dans le noyau partagé utilisé par cinq projections. Proposition : lire la
   colonne comme le `Date` que donne le pilote ; ajouter un cas en millisecondes à
   `readModelStoreContract` ; donner des millisecondes aux horloges des *specs* générées.
2. **La CLI ne connaît pas les projections.** Le noyau et trois README présentent `@Projection`
   dans `application/projections/` comme la façon de tenir un modèle de lecture ; `check`
   refuse le répertoire (`tree/closed`), `docs` laisse les classes hors du barrel, donc une
   projection n'est silencieusement pas abonnée, et il n'existe aucun générateur. Coût : une
   dérogation avec son enregistrement de décision pour une fonctionnalité documentée, trois
   entrées de configuration à la main, cinq enregistrements à la main dans des lignes générées,
   et quatre *workers* qui le découvrent chacun de leur côté. Le README de `@ddd-ts-kit/di`
   l'admet en une phrase ; la référence d'architecture ne liste pas le répertoire. Proposition :
   `generate projection <context> <Name> --on <event>...` (classe, port, adaptateur de store,
   table, *fake*, *spec*), le répertoire dans l'arborescence canonique, le rôle dans le barrel.
3. **`generate query --list` écrit une autre liste que celle qu'enseignent les README.** Il
   donne un port de lecteur qui prend `(scope, page)`, un lecteur en mémoire nommé
   `*.repository.ts` et un *fake* ; les README du noyau, de http et de knex enseignent
   `Criteria`, `ReadModelStore`, `scoped` et `criteriaQuerySchema`. Les quatre exécutions se
   sont terminées par la suppression du port, du lecteur et du *fake* générés (15 fichiers) et
   la réécriture de la requête, du gestionnaire et de la route. Proposition : `--list --criteria`
   qui écrit la définition des critères, le port du modèle de lecture et la route avec
   `criteriaQuerySchema`, ou en faire le comportement par défaut.
4. **L'amorçage `rebac` est un substitut, et les générateurs continuent d'écrire pour lui.** Le
   store est en mémoire et un singleton ; chaque `@Requires` nomme `context:<name>` ; la base de
   bout en bout générée relie `context:<name>#operator` et attend un 403 d'un inconnu, ce qui est
   faux dès que le modèle est réel ; les gestionnaires d'événements d'intégration ont besoin
   d'une autorisation système écrite à la main ; `Access.authorize(actor, permission, aggregate)`
   a besoin d'un `resourceOf` qu'aucun *skill* ne mentionne et que les *specs* de gestionnaires
   sur les rôles ne peuvent pas détecter. Coût : un *worker* pour la plateforme (157 k jetons),
   12 fichiers recâblés, 7 *specs* de bout en bout réécrites. Proposition : livrer un
   `RelationTupleStore` Knex dans `@ddd-ts-kit/knex` (la suite de contrat existe) et faire que
   `init` le lie à travers la persistance ; `--resource <type>:<field>` sur `command` et
   `query` ; une règle qui laisse un acteur système opérer son propre contexte ; `resourceOf`
   dans le *skill* access-control.
5. **Le côté amont d'une *gateway* n'appartient à personne.** `generate gateway` lie le contrat
   à `{}` dans les deux modules de la plateforme : il cesse de compiler à la première méthode du
   contrat, et une implémentation déclarée dans le contexte amont est alors « bound twice ». Deux
   *workers* ont trouvé deux issues différentes (une classe non déclarée liée par la plateforme ;
   `replaces: true`). Proposition : générer l'implémentation dans l'`infrastructure/` de l'amont
   avec une déclaration, et ne lier un remplaçant inerte et typé que dans le module de test.
6. **Le *fake* de *repository* généré perd les objets-valeurs.** `snapshots()` passe par
   `structuredClone`, qui transforme en objets ordinaires les objets-valeurs que demande le
   `TODO` de l'agrégat. Six *fakes* corrigés de la même façon par quatre *workers*. Proposition :
   générer le *fake* avec `{ clone: rehydrate }` dès le départ.
7. **Un projet généré ne survit pas à un *workspace*.** Trois corrections avant la première
   porte verte : le chemin du compilateur, le binaire de la CLI (défaut 2), dependency-cruiser
   qui suit les liens. Proposition : des scripts qui résolvent leurs outils (`ddd-ts-kit tsc`),
   `preserveSymlinks` dans la configuration générée, un bit d'exécution posé par le build de la
   CLI.
8. **Un refus perd sa raison deux fois.** `ForbiddenError.reason` (le nom de la politique)
   n'est pas dans le document *problem* HTTP, et la décision refusée d'une politique interrogée
   dans un gestionnaire est écrite dans l'unité de travail que le refus annule : le journal ne
   garde que `command failed FORBIDDEN`. Le « 403 avec le code de la politique » demandé à cet
   exemple n'a pas pu être livré. Proposition : un membre `reason` facultatif dans le document
   *problem* ; enregistrer les décisions hors de l'unité de travail, comme le fait le
   *middleware* des commandes pour les échecs.
9. **La porte du glossaire coûte une exécution par mot.** 27 exécutions refusées : `List`,
   `Read`, `Get`, le verbe d'action d'une permission, le mot `Practice` dans scheduling. Le
   message est clair, mais il nomme un seul mot manquant à la fois, liste le `--term` de
   l'exécution refusée comme existant, et `LastManager` a été refusé par
   `language/no-technical-name` alors que `Manager` est un terme du glossaire de ce contexte.
   Proposition : signaler tous les mots manquants d'un coup ; laisser le glossaire primer sur la
   liste des noms techniques ; traiter `List`, `Get`, `Read` comme des verbes de requêtes sans
   terme.
10. **`generate adapter` ne connaît qu'un adaptateur : un client distant.** Un port dont
    l'adaptateur écrit des tuples de relations, ou journalise un mail, reçoit un transport avec
    nouvelle tentative et délai d'expiration à supprimer, et le nom `remote-...` reste. Le
    marqueur de `event-handler` dit « exécuter une commande » là où la façon documentée de tenir
    les relations à jour est d'appeler un port. Proposition : `--kind local`.
11. **Un consommateur par événement et par contexte.** `integration-handler` nomme son
    gestionnaire d'après l'événement et ne prend pas de nom : une seconde réaction du même
    contexte au même événement ne peut pas être générée. Les rappels sont donc planifiés par une
    réaction à « notification envoyée », et une notification qui part en file de rejet emporte
    son rappel avec elle. Proposition : `--name`.
12. **Les générateurs et `docs` réécrivent d'autres contextes.** Un `generate port` dans
    `identity` a réécrit le barrel et le `CONTEXT.md` d'`analytics` et de `scheduling` ; avec des
    *workers* qui partagent une arborescence, cela a fait passer au rouge les *specs* d'un voisin
    deux fois pendant quelques secondes. Avec des *worktrees*, cela aurait été un conflit de
    fusion dans des fichiers générés. `--local-only` existe, mais l'aide dit que ces types
    n'écrivent rien de partagé.
13. Des plus petites, quelques minutes chacune : `tree/context-doc` a lu le mot « generic » dans
    la phrase sous `## Classification` comme une seconde classification ; une politique générée
    avant sa commande donne à la permission le nom de la politique comme description ; les
    *payloads* class-validator ne peuvent pas décrire un champ (`class-validator-jsonschema`
    n'est pas autorisé dans un langage publié, le *skill* demande des descriptions) ; le preset
    ESLint ne déclare aucune variable globale de Node pour les scripts `.mjs` (`fetch`, `URL`,
    `Buffer`) ; `vitest.config.ts` lance les *specs* d'adaptateurs en parallèle sur une
    `DATABASE_URL` partagée, où elles se tronquent les unes les autres (la configuration de bout
    en bout s'en protège) ; `generate e2e` nomme son fichier d'après le cas d'usage sans le
    contexte ; `generate route` dit « create it with `generate command` » pour une requête
    manquante ; une ligne de journal du *middleware* du bus porte deux fois la clé `message` ;
    les lignes d'échec du bus d'événements ne portent aucun identifiant de corrélation ; le
    *skill* d'amorçage supprime le glossaire et le brouillon de la carte, donc le chemin ne peut
    pas être rejoué (gardés ici dans `docs/architecture/before-bootstrap/`).

## Contradictions entre un *skill*, un README et l'outil

| Dit | Contre |
|---|---|
| README de `@ddd-ts-kit/auth` : « les événements du domaine sont distribués après la validation (commit) », donc un tuple écrit par un gestionnaire d'événement est une seconde étape | la référence d'architecture et le noyau : les événements partent avec la sauvegarde, dans l'unité de travail. L'outil fait la seconde chose ; l'exemple s'appuie dessus et le prouve |
| README du noyau : une `interface` de ligne exportée à côté d'un port de lecture | `ports/abstract-class` la refuse (son message dit d'utiliser un `type`) |
| README de `@ddd-ts-kit/di` : `contextModule` prend une projection | le barrel généré n'en liste jamais |
| README de `@ddd-ts-kit/knex`, modèles de lecture | `keyColumn` est obligatoire quand la clé n'est pas `id` ; pas montré |
| *skill* integration-event : décrire chaque champ du *payload* | impossible avec class-validator parmi les *packages* autorisés |
| *skill* d'amorçage : « le projet vide est vert » | vrai seulement après le premier `generate context` |
| *skill* parallel-work : quatre *workers* au plus | cinq *workers* de contexte et un *worker* de plateforme ont tourné ici en même temps sur une arborescence partagée sans souci ; la limite qui a compté était le nombre de mains dans un même contexte (deux) |

## Violations de règles rencontrées, et si le message disait quoi faire

| Règle | Rencontrée par | Message |
|---|---|---|
| `clean-stepdown`, taille des fonctions, plafond de 100 lignes d'un `describe` | chaque *worker*, dans les *specs* | clair, avec la correction ; le squelette de *spec* généré invite à la violation |
| `language/glossary-term` | 27 exécutions | clair, un mot à la fois |
| `language/no-technical-name` | `LastManager` ; l'import du `ReadModelStore` du noyau lui-même dans un gestionnaire (« Model ») | clair, mais faux dans les deux cas |
| `tree/closed` | les projections | clair, avec la correction (un répertoire supplémentaire) |
| `declarations/role-declared` | un lecteur en mémoire laissé à côté de son jumeau Knex | clair |
| `ports/abstract-class` | une interface de ligne dans un fichier de port | clair |
| `clean-no-escape-hatch` | une garde de type écrite avec une assertion | clair, avec trois alternatives |
| câblage : « bound twice » | les contrats des *gateways* | nomme le port et les modules |

## Ce qui a été agréable

- Une seule commande `init`, puis un squelette qui compile, lint et teste, avec les deux
  *pipelines*, un realm, un fichier compose et des règles pour les agents : les questions de
  *stack* étaient tranchées avant tout code.
- La liste `next` de chaque générateur : les *workers* ont ouvert ces lignes et peu d'autres.
- Les suites de contrat : *fakes* et adaptateurs tenus au même comportement sans l'écrire.
- PGlite : les *specs* d'adaptateurs et la contrainte d'exclusion (`btree_gist`) ont tourné dans
  le processus du premier coup ; les mêmes *specs* sont ensuite passées sur PostgreSQL 18 avec
  de vraies transactions concurrentes.
- `composeApplication` sur une vraie base de données dans une *spec*, `expectSpanTree`, et une
  seule trace de la requête HTTP à trois consommateurs sans une ligne de traçage dans un
  contexte.
- Les messages du linter et des erreurs de câblage disent quoi faire à la place.
- L'exécution réelle a passé ses six premières étapes du premier coup, avec de vrais jetons
  Keycloak.

## Travail en parallèle : ce qui s'est passé

| *Worker* | Périmètre | Exécutions de générateurs | Résultat |
|---|---|---|---|
| plateforme | `src/platform/auth`, bus, support de test | 1 | terminé en 9 min |
| identity | le contexte | 47 | tranches 11 à 17, 286 tests, 36 tests de bout en bout |
| scheduling-calendar | Calendar, Waitlist, praticiens, vue du jour | 50 | tranches 18 à 21, 28, 29 |
| scheduling-appointment | Appointment, Scheduler, listes, export | 34 | tranches 21 à 27, 30 ; rappelé une fois pour le défaut des modèles de lecture |
| notification | le contexte | 22 | tranches 31 à 34, 184 tests |
| analytics | le contexte | 7 | tranches 35 à 37, 94 tests |
| bout en bout | `test/e2e/journey-*`, corrections d'intégration | 0 | 17 tests, trois fautes d'intégration corrigées |

Il n'y a pas de git dans cette construction, donc les *workers* ont partagé une seule
arborescence au lieu d'un *worktree* chacun, et chaque exécution de générateur a été sérialisée
derrière un verrou (`scripts/kit.mjs`). Collisions : aucune n'a perdu de travail.
Quasi-collisions : le port `SchedulingRelationships`, créé par une moitié de scheduling et
complété par l'autre, comme prévu dans les consignes ; deux états rouges passagers des *specs*
d'un voisin (friction 12, et un import cassé pendant quelques secondes). Les contrats d'abord,
cela a payé : aucun *worker* n'en a attendu un autre et aucun *payload* n'a changé après le
départ des *workers*. Ce qui n'a pas payé : demander à chaque contexte ses propres *specs* de
bout en bout avant que la composition existe (quatre *workers* sur cinq n'ont pas pu les
écrire), et confier les projections dans les consignes sans générateur (chaque *worker* a lu les
trois mêmes sections de README et écrit le même adaptateur).

Lecture estimée par tranche, d'après les rapports des *workers* : les fichiers générés de la
tranche (5 à 12 fichiers, autour de leurs lignes `TODO`), une ou deux sections de README pour
tout ce qui dépasse une commande simple, et une fois par *worker* les règles, les tranches et
quatre *skills*. Les tranches qui ont coûté en lecture étaient celles sans générateur :
projections (README du noyau, de knex et de di), listes à critères (noyau, http, knex), la
reconstruction (source du noyau).

## Défauts trouvés dans les *packages* du kit

1. **`@ddd-ts-kit/knex`, modèles de lecture : l'horodatage est relu sans ses millisecondes.**
   `packages/knex/src/read-model/knex-stamped-rows.ts:33` construit
   `new Date(String(record['last_event_at']))` ; le pilote répond un `Date`, et `String(date)` a
   une précision d'une seconde. `replace()` filtre ensuite sur
   `last_event_at = <truncated instant>` et ne trouve aucune ligne. Reproduction : avec un
   `KnexReadModelStore` sur PostgreSQL ou PGlite, `upsertIfNewer(key, { eventId: 'a', occurredAt:
   new Date('2026-01-01T00:00:00.123Z') }, ...)`, puis un second `upsertIfNewer` sur la même clé
   avec un horodatage plus tardif : cinq tentatives, puis `ConcurrencyError`. Tout horodatage
   dont les millisecondes valent zéro le masque, et c'est ce que donnent les horloges fixes.
   Contourné dans `src/shared-kernel/storable-stamp.ts` (instant arrondi à la seconde inférieure,
   ordre porté par une version), avec une *spec* de régression par adaptateur.
2. **`ddd-ts-kit` (la CLI) : `dist/bin.js` n'est pas exécutable après le build.** Dans ce dépôt,
   `npm ci && npm run build`, puis tout script d'un *workspace* qui appelle le binaire
   `ddd-ts-kit` répond `sh: 1: ddd-ts-kit: Permission denied` : le compilateur écrit le fichier
   sans le bit d'exécution. Un *package* publié n'est pas concerné (le gestionnaire de
   *packages* pose le bit à l'installation). Contourné en appelant la CLI avec `node`
   (`scripts/kit.mjs`).

Soupçonnés, non confirmés comme défauts : la vue générée des entrées d'audit omet
`impersonatedBy` (*template*) ; le *middleware* du bus journalise deux fois `message` dans une
même ligne JSON.

## Non construit, ou construit plus petit que demandé

- Le code de raison de la politique dans la réponse HTTP d'une annulation refusée : la réponse
  est `403 FORBIDDEN` et nomme la permission (friction 8). La décision de la politique est
  couverte par sa propre *spec* et par la *spec* du parcours ; elle n'est pas dans le journal
  d'audit.
- Un adaptateur de métriques (`TODO(platform)` dans `src/platform/observability/create-metrics.ts`),
  la déclaration des champs audités (`src/platform/audit/create-audit.ts`), et les deux
  adaptateurs distants de *gateways* pour le jour où un contexte sera extrait : les quatre
  `TODO(platform)` restants.
- Le port de mail a son adaptateur de développement (il écrit dans le journal) et un *fake* qui
  échoue à la demande ; pas d'attrape-mails SMTP.
- L'occupation est tenue en minutes et compte par calendrier et par jour, pas comme un taux
  rapporté aux heures d'ouverture ; la vérification nocturne parcourt des jours UTC.
- Quitter une liste d'attente, lister les membres et les délégations, une organisation
  au-dessus des cabinets.
- `@Cached` et `@CircuitBreaker` ne sont pas utilisés : les décorateurs montrés sont `@Retry` et
  `@Timeout` sur l'envoi de mails ; la forme au niveau de la liaison est la politique de la
  plateforme autour de chaque liaison `external` et `gateway`.
- Aucun point d'entrée ne lance `ProjectionRebuild` en production : il est exercé par une
  *spec*.
- La séquence d'un clone neuf `npm ci && npm run build && npm run example:verify` a été vérifiée
  morceau par morceau (`npm ci --dry-run` contre le lockfile, le build, la porte), pas depuis un
  second clone.

## Questions métier ouvertes laissées par les *workers*

Prises telles qu'écrites dans le code, à confirmer avec le *product owner* : un rendez-vous
demandé a 24 heures pour être confirmé ; une offre venue de la liste d'attente ignore la limite
du patient ; une personne en attente quitte la liste d'attente dès qu'un créneau lui est
proposé ; une offre qui échoue fait échouer l'annulation qui a libéré le créneau ; l'ouverture
d'un cabinet annonce aussi son premier responsable comme membre ; les fuseaux horaires sans zone
(`UTC`) sont refusés ; une réservation faite moins de 24 heures à l'avance est rappelée au
prochain passage du *job* ; un contact ne change jamais après la première inscription ; les
rendez-vous tenus comptent ensemble les tenus, les terminés et les absences.

## Après la livraison : des statistiques calculées à la lecture

2026-10-10, après la livraison de la construction ci-dessus. Tout ce qui précède cette section est
le rapport de la construction et reste tel qu'il a été écrit ; là où il parle de cinq projections,
de quatre *jobs* planifiés, du registre d'occupation ou de la vérification nocturne, il décrit
l'état d'avant ce changement.

**La décision (*product owner*).** Dans `analytics`, garder une ligne par fait et calculer à la
lecture, au lieu de tenir des chiffres que les événements incrémentent ou recomptent.

**Ce qui a changé.**

- Retiré : la projection `analytics.occupancy`, le port `OccupancyRegister` avec son adaptateur
  Knex et son *fake*, la table `analytics.occupancy`, la commande `VerifyOccupancy` avec son
  gestionnaire, le *job* `analytics.verify-occupancy`, la permission
  `analytics:occupancy.verify`, l'autorisation de l'acteur système du *job*, la ligne du *job*
  dans `src/platform/job-settings.ts` (et avec elle la clé
  `JOB_ANALYTICS_VERIFY_OCCUPANCY_ENABLED`, qu'aucun fichier de l'exemple ne positionnait),
  leurs cinq *specs*, et l'objet-valeur `Day` avec son erreur `InvalidDayError`, que seule la
  vérification utilisait.
- Ajouté : le port `OccupancyReader` (`generate port`), son adaptateur Knex
  `knex-occupancy-reader.repository.ts` (à la main : une seule instruction groupée sur les
  issues), son *fake* (le service du domaine sur les issues d'un registre) et une suite de
  contrat que les deux passent, `test/integration/occupancy-reader.contract.spec.ts`, 17 cas
  pour chacun.
- Gardé : la projection `analytics.outcomes`, idempotente et sûre face au désordre grâce à
  l'horodatage de ses lignes, son contrat et sa *spec* de reconstruction ; le service du domaine
  `OccupancyMeasureService`, désormais la définition à laquelle l'instruction SQL est tenue ; la
  requête `ListOccupancy`, sa route et sa réponse, inchangées pour un client
  (`openapi/openapi.json` est identique octet pour octet).
- Schéma : la création des tables a été modifiée, sans ajouter de migration, puisqu'aucune base
  de données de cet exemple n'est déployée : `analytics.occupancy` n'est plus créée,
  `outcomes.calendar_id` est déclarée `COLLATE "C"` (les lignes sont ordonnées par calendrier et
  par une clé faite du calendrier et du jour), et `outcomes` reçoit l'index
  `(practice_id, day, calendar_id)`. Une base créée avant ce changement doit être recréée.
- Un comportement diffère : un calendrier et un jour qu'un rendez-vous a quittés (déplacé vers
  un autre jour) et qui ne contiennent aucun autre rendez-vous n'ont plus de ligne, là où le
  modèle stocké gardait une ligne de zéros. Un jour dont tous les rendez-vous ont été annulés a
  toujours sa ligne.

**Comptes, contexte `analytics`.**

| | Avant | Après |
|---|---|---|
| Fichiers | 47 | 36 |
| Lignes | 2 039 | 1 732 |
| Fichiers et lignes de source (hors de `test/`) | 26, 789 | 20, 579 |
| Fichiers et lignes de test | 20, 1 158 | 15, 1 028 |
| `CONTEXT.md` | 92 | 125 (la nouvelle section « How occupancy is measured ») |
| Modèles de lecture, tables | 2, 2 | 1, 1 |
| *Jobs* planifiés, commandes, permissions | 1, 1, 2 | 0, 0, 1 |
| Consommateurs de chaque événement de rendez-vous | 2 | 1 |

Hors du contexte : trois lignes de moins dans `src/platform/` (`compose-application.ts`,
`auth/relate-system-actors.ts`, `job-settings.ts`), quatre de moins dans
`test/e2e/journey-observability.e2e.spec.ts` (la trace d'une réservation a perdu un
consommateur). La porte compte 1 282 tests unitaires et d'adaptateurs (1 288 avant) et les
mêmes 57 de bout en bout. Les 210 lignes de source que le contexte a perdues, en net, étaient la
partie qui défendait une copie : recompter à chaque événement, choisir entre le fait et une
issue plus tardive déjà stockée, une écriture périmée laissée à la nuit, le *job* de nuit.

**La porte et les exécutions réelles.** `npm run verify` est vert. Le contrat d'`OccupancyReader`
passe sur PGlite et sur PostgreSQL 18 (il lit `DATABASE_URL` ; sur une table vide, le
planificateur sert déjà l'instruction groupée depuis le nouvel index). `scripts/demo.mjs` a été
rejoué pour de vrai sur une base vide ; `docs/demo-transcript.md` garde la première exécution et
ajoute les deux étapes qui ont changé. Deux choses rencontrées en chemin, aucune causée par ce
changement :

- `npm run test:postgres` lance la plupart des suites de contrat sur PGlite même avec
  `DATABASE_URL` positionnée : seules les *specs* qui passent la variable à `openTestDatabase`
  atteignent le serveur (deux de `scheduling`, et désormais le contrat d'`OccupancyReader`). Le
  chiffre clé « les tests d'adaptateurs passent aussi sur PostgreSQL 18 » plus haut est vrai de
  celles-là. Proposition pour l'exemple : `openTestDatabase()` lit `DATABASE_URL` lui-même.
- Sur PostgreSQL 18, `scheduling/test/integration/concurrent-booking.spec.ts`, « refuses a
  booking that starts in the buffer of one made at the same instant, and takes one that does not
  touch them », échoue environ une fois sur deux (409 là où 201 est attendu) : quand la
  réservation dans la marge gagne la course, la troisième tombe dans sa marge. Un défaut de la
  *spec*, laissé tel quel.

**Ce que cela dit pour le kit.**

1. **Il n'existe aucune façon prise en charge d'écrire une lecture agrégée.** Le README du
   noyau le dit en une ligne (« Pas d'agrégation ») et s'arrête là, `ReadModelStore.list`
   répond des lignes, et `generate query --list` (friction 3) n'écrit ni l'un ni l'autre. Les
   pièces suffisent pourtant presque : `planCriteria` valide la lecture et joint le périmètre,
   `predicateToKnex` rend les filtres, `criteriaToKnex` le keyset, l'ordre et la fenêtre,
   `evaluateCriteria` donne le *fake* gratuitement une fois les lignes calculées en mémoire. Ce
   qu'il a fallu trouver en lisant la source de `@ddd-ts-kit/knex` : les filtres et le périmètre
   doivent aller dans la sous-requête groupée, et le keyset, l'ordre et la fenêtre à
   l'extérieur, ce qui se fait en appelant
   `criteriaToKnex(outer, { ...plan, filter: undefined }, columns)` ; le total d'une page par
   décalage est un comptage de groupes, écrit à la main. Proposition : (a) une section
   « Aggregate reads » dans les README du noyau et de chaque adaptateur avec cette recette ;
   (b) dans les adaptateurs, `windowToKnex(builder, plan, columns)` (keyset, ordre, fenêtre,
   sans filtre) à côté de `predicateToKnex`, pour que personne ne modifie un plan ; (c) dans
   `defineCriteria`, un champ déclaré `computed: true` : jamais filtrable, jamais la cible d'une
   correspondance de périmètre, refusé quand la définition se charge plutôt que quand une
   instruction est construite (aujourd'hui l'adaptateur le refuse tard, parce que le champ n'a
   pas de colonne parmi celles qui sont groupées) ; (d) `generate query <context> <Name> --list
   --grouped-by <fields>` qui écrit le port, le squelette de l'adaptateur, le *fake* sur
   `evaluateCriteria` et la *spec* de contrat partagée.
2. **Une définition et son SQL peuvent être tenus égaux par la suite de contrat, et rien ne le
   dit.** Le patron utilisé ici (un service du domaine qui mesure, un *fake* qui l'appelle, un
   adaptateur qui le traduit, une seule suite avec des chiffres calculés à la main pour les
   deux) est ce qui rend « calculé dans la base de données » sûr à maintenir.
   `@ddd-ts-kit/testing/contracts` a `criteriaContract` et `readModelStoreContract` ;
   proposition : documenter ce troisième usage dans le README de testing, avec les cas qu'une
   agrégation doit couvrir (un groupe qui se vide, l'arrondi par ligne ou par groupe, une ligne
   marquée supprimée par une reconstruction, le total au-delà de la dernière page).
3. **Aucun générateur n'écrit d'adaptateur de persistance pour un port de l'application.**
   `generate adapter` n'écrit que dans `infrastructure/external` ; le lecteur Knex a été écrit à
   la main d'après celui de `notification`. Proposition : `generate adapter <context> <Port>
   --kind persistence`, déclaré avec `@Repository(Port, [KnexContext])`, avec sa *spec* de
   contrat sur le *fake* et l'adaptateur.
4. **Rien ne retire ce qu'un générateur a écrit, et rien ne remarque ce qui reste.** Retirer une
   commande et son *job* a voulu dire supprimer des fichiers et modifier à la main quatre
   régions générées (`ddd-ts-kit:permissions`, `ddd-ts-kit:system-grants`, `ddd-ts-kit:jobs`,
   les projections nommées dans `compose-application.ts`) ; `docs` a ensuite réparé le barrel et
   le `CONTEXT.md`. Vérifié exprès : avec l'autorisation de l'acteur système du *job* retiré et
   sa ligne de réglages de *jobs* remises, `ddd-ts-kit check`, le compilateur et une *spec* de
   bout en bout restent tous verts. Proposition : `check` compare les noms de ces régions aux
   *jobs* et permissions déclarés (une règle `config/no-orphan-registration`), et une commande
   `ddd-ts-kit remove <kind> <context> <Name>` qui défait ce que `generate` a listé dans
   `created` et `updated`.
5. **La collation est facile à rater dans une clé calculée.** Les lignes sont ordonnées par une
   clé construite à partir de deux colonnes de texte ; les deux doivent être `COLLATE "C"`, sinon
   PostgreSQL ne peut pas décider de la collation de la clé. Le README de `@ddd-ts-kit/knex`
   couvre les colonnes triées, pas les expressions. Proposition : une phrase à cet endroit.

Les deux exécutions de générateurs de ce changement (`generate port analytics OccupancyReader`,
`docs`) sont dans le journal tenu par `scripts/kit.mjs` ; `docs/tooling/generator-log.jsonl` est
la copie faite à la fin de la construction et n'a pas été rafraîchi.

## Après la livraison : les événements du domaine distribués à la fin de l'unité de travail

2026-10-10. Le kit a changé le moment où un événement du domaine atteint ses gestionnaires : non
plus après chaque sauvegarde, mais une fois que le gestionnaire de commande a rendu la main,
dans la transaction et avant sa validation (commit), avec une phase `after-commit` pour ce
qu'aucune transaction ne couvre. La garantie : un effet d'un événement du domaine n'existe que si
le changement d'état qui l'a enregistré est validé. Ce que cela a demandé ici, et ce que les
outils ont dit.

Ce qui a changé dans l'exemple :

1. **Aucun gestionnaire n'a été réécrit.** Les vingt-six gestionnaires d'événements du domaine
   sont déclarés, dans la phase par défaut, et leurs dépendances sont le bus de commandes, le
   *publisher* de l'outbox, un *repository* ou un port de relations. Les *specs* unitaires et
   d'intégration sont passées sans retouche (1282 tests) : elles appellent les gestionnaires
   directement ou à travers l'application de test, et aucune ne comptait sur un gestionnaire qui
   tourne entre deux sauvegardes.
2. **Deux adaptateurs ont bougé, et c'est la décision.** `RemoteIdentityRelationships` et
   `RemoteSchedulingRelationships` étaient ce qu'écrit `generate adapter` : sous
   `infrastructure/external/`, de type `external`, derrière sept gestionnaires qui tournent avant
   la validation. La nouvelle règle `domain-events/transactional-before-commit` refuse cette
   forme, et elle a raison : une écriture distante avant la validation survit à une annulation
   (rollback). À y regarder de près, le store n'est pas distant : `RelationTupleStore` est lié à
   `KnexRelationTupleStore`, une table de la même base de données écrite dans la transaction de
   la commande (ADR-0001). La correction honnête était de le dire : les adaptateurs sont
   désormais `TupleIdentityRelationships` et `TupleSchedulingRelationships`, dans
   `infrastructure/persistence/`, déclarés avec `@Repository`, sans la politique de résilience
   vide qu'ils portaient. Les gestionnaires restent avant la validation, donc une relation est
   validée ou annulée avec son fait, ce que ne donneraient ni la phase `after-commit` (au plus
   une fois : un droit jamais retiré après un plantage) ni un événement d'intégration consommé
   par le même contexte (un droit qui traîne derrière son fait). Le raisonnement, et quoi faire
   le jour où les tuples passeront dans un service distant, sont dans le `CONTEXT.md`
   d'`identity`. Une nouvelle *spec* d'intégration, `relationships-commit-with-the-fact.spec.ts`,
   le prouve sur PostgreSQL.
3. **Sept arbres de *spans* ont changé, comme prévu.** Les gestionnaires ont quitté le *span* de
   la sauvegarde : sous la commande viennent les sauvegardes, puis
   `unit-of-work before-commit` avec les événements et leurs gestionnaires.
   `identity-remove-member` montre deux de ces *spans*, le second pour la délégation que le
   premier gestionnaire a terminée. Les *spans* des relations sont nommés
   `repository ...Relationships.*` au lieu de `external ...`.
4. **Un ordre a changé dans `journey-observability`.** Le consommateur de `notification` ouvre
   l'unité de travail (la marque de l'événement et le changement d'état sont validés ensemble)
   et envoie `SendNotificationCommand`, qui la rejoint. Le fait
   `notification.notification.sent` est donc distribué à la fin de l'unité de travail du
   consommateur, après le retour de la commande : `unit-of-work before-commit` est un frère du
   *span* de la commande sous `process ...`, et la ligne de journal de `PlanReminderCommand`
   suit désormais celle de `SendNotificationCommand`. Les deux sont toujours validées ou
   annulées ensemble.

Ce que les outils ont bien fait : la règle et le *checker* sont d'accord avec le code dès que
l'adaptateur dit ce qu'il est, `docs` a réparé les deux barrels et les deux `CONTEXT.md` après le
déplacement, et `expectSpanTree` a affiché côte à côte l'arbre attendu et l'arbre trouvé, ce qui
a fait de chacune des huit attentes un exercice de lecture.

Frictions :

1. **`generate adapter` nomme chaque adaptateur `Remote...` et le range sous
   `infrastructure/external/`**, donc un adaptateur qui écrit dans la transaction commence sa
   vie déclaré comme un système extérieur. C'est la friction 3 de la section précédente vue de
   l'autre côté : avec `generate adapter <context> <Port> --kind persistence`, les deux
   adaptateurs auraient été déclarés correctement dès le départ, et la nouvelle règle n'aurait
   rien eu à dire.
2. **Rien ne déplace un fichier généré.** Les deux déplacements ont été des `mv`, deux
   renommages de classes, deux renommages de *specs* et une exécution de `docs` ;
   `ddd-ts-kit check` a ensuite confirmé l'arborescence.
3. **`SendNotificationHandler` appelle `Mailer.deliver` dans la transaction de sa commande.** La
   nouvelle règle ne juge que les gestionnaires d'événements du domaine, donc elle ne dit rien,
   et le gestionnaire se protège d'un second mail avec `findByCause`. Un mail peut encore partir
   pour une notification dont la validation a échoué. C'est la même question un niveau plus
   haut (un effet hors de la base de données avant la validation) et aucune règle ne la tient
   pour les gestionnaires de commandes. Laissé tel quel, exprès : hors du périmètre de ce
   changement.
4. **`docs/demo-transcript.md` est un enregistrement** fait avant ce changement : ses noms de
   *spans* (`external SchedulingRelationships.recordAppointment`, pas de
   `unit-of-work before-commit`) sont ceux de cette exécution, et ont été laissés tels
   qu'enregistrés.

L'exécution de générateur de ce changement (`docs`) est dans le journal tenu par
`scripts/kit.mjs` ; `docs/tooling/generator-log.jsonl` n'a pas été rafraîchi.

## 2026-10-10 : chaque import par son alias (subpath imports de Node)

L'exemple importait en relatif partout (`../../../domain/...`) alors que sa configuration nommait
un alias, `@/`, que seuls `tsconfig.json` et les configurations de vitest connaissaient : un
import par l'alias aurait passé la vérification des types, puis échoué sous
`node dist/src/main.js`. L'alias est désormais `#src/`, un subpath import de Node déclaré une
seule fois sous `imports` dans `package.json`, avec `#test/` et `#scripts/` à côté, et la règle
`imports/alias-only` refuse un import relatif.

Ce qui a été fait, dans l'ordre :

1. À la main, les déclarations qu'`init` écrit pour un nouveau projet : `importAlias` `#src/`
   dans la configuration, les `imports` de `package.json`, `--conditions=ddd-ts-kit-source` dans
   le script `dev`, `paths` retiré de `tsconfig.json`, `ssr.resolve.conditions` à la place de
   `resolve.alias` dans les deux configurations de vitest. `ddd-ts-kit check` a nommé chacune
   de celles qui manquaient (`imports/alias-declared`), avec le texte à écrire.
2. `node scripts/kit.mjs depcruise-config --write` : la configuration du graphe générée résout
   sous la condition des sources.
3. `npx eslint . --fix` : 2097 imports réécrits dans 557 fichiers (2019 sous `src/`, 73 sous
   `test/`, 5 sous `scripts/`), les quatre barrels compris. Le *checker* a compté les mêmes 2097
   avant la correction et aucun après. Puis `npm run format` : 25 fichiers remis en forme,
   puisqu'un chemin d'alias est plus long. Un second `eslint . --fix` n'a changé aucun fichier.
4. `migrations/0001_initial.js` nomme le schéma compilé par `#src/platform/database/schema.js`
   au lieu de `../dist/src/...` : sous le `node` simple de la CLI de knex, l'alias répond
   `dist/`.

Vérifié ensuite : `npm run typecheck`, `npm run build`, 1285 *specs* unitaires et d'adaptateurs,
57 *specs* de bout en bout, dependency-cruiser (759 modules, aucune violation), knip,
`docs:check`. Le `node` simple lie les 463 modules compilés sur Node 22.23 et Node 24.21 sans
aucun alias laissé non résolu ; `node dist/src/main.js`, le *worker* et `tsx` sur `src/main.ts`
tournent chacun jusqu'à la connexion à PostgreSQL, à laquelle aucun serveur ne répondait sur
cette machine : le démarrage complet avec les services de compose n'a pas été rejoué.

Ce que les outils ont bien fait : la correction n'a demandé aucune décision, fichier par fichier,
et le formateur a absorbé chaque ligne longue ; aucun fichier n'a dépassé 350 lignes ni aucune
fonction 30, puisque les imports ne comptent ni dans l'un ni dans l'autre. `docs` n'avait rien à
réécrire après la correction : les barrels qu'ESLint a corrigés étaient déjà ce qu'écrit le
générateur.

Frictions :

1. **Trois outils chargent la copie compilée en silence quand la condition manque** : tsx,
   vitest et jest résolvent un alias vers `dist/` comme le fait `node`, donc un build périmé
   serait testé à la place des sources. C'est ce que vérifie `imports/alias-declared` dans les
   scripts et dans les configurations des lanceurs de tests, et la raison pour laquelle la
   condition est dans chacun d'eux.
2. **Renommer l'alias n'est pas une commande.** La configuration, l'entrée `imports` et le
   préfixe dans les sources sont trois modifications ; le *checker* nomme les deux premières.
3. **`docs/demo-transcript.md` et `docs/tooling/` sont des enregistrements** faits avant ce
   changement et ont été laissés tels qu'enregistrés.

## 2026-10-10 : la couverture comme réglage gouverné, et chaque règle prouvée sur cette application

### Ce qui a changé ici

- `vitest.config.ts` n'écrit plus aucun seuil : il étale `governedCoverage(mode)` de
  `@ddd-ts-kit/testing/coverage`, qui lit la clé `coverage` de `ddd-ts-kit.config.json`. Cette
  application ne fixe aucun taux, donc la référence s'applique : domaine 90/85/90/90,
  application 85/80/85/85, présentation 80/70/80/80, infrastructure 70/60/70/70 (instructions,
  branches, fonctions, lignes), à chaque contexte pris seul.
- `npm run verify` lance désormais `npm run test:coverage` (chaque *spec* une fois, les quatre
  couches mesurées) là où il lançait `npm run test` : les seuils sont imposés par la porte
  qu'un développeur lance, pas seulement par le *pipeline*.
- `plugins: [decoratorCoverage()]` dans `vitest.config.ts` : cette application compile avec
  `emitDecoratorMetadata`, et la transformation protège chaque type que nomme une classe décorée
  avec `typeof Port === "undefined" ? Object : Port`, une branche qu'aucun test ne prend.

### Ce que la mesure a trouvé

Avant ce changement, le script de *pipeline* `ci:test:unit` de cette application échouait : le
taux de branches d'`application/` était de 74,1 % pour un plancher de 80 %, et `verify` ne le
disait pas parce qu'il ne mesurait rien. Deux causes :

1. **Le compilateur, pas le code.** La plupart des branches non couvertes d'`application/`
   étaient les gardes de métadonnées ci-dessus, une par port de chaque gestionnaire déclaré.
   Avec `decoratorCoverage()`, le taux de branches des quatre couches `application/` est entre
   98,68 % et 100 %.
2. **Trois vrais manques**, chacun comblé par une *spec*, aucun par un seuil abaissé :
   - `analyticsRoutes`, `identityRoutes` et `notificationRoutes` n'étaient appelés que par les
     *specs* de bout en bout, qui ne sont pas mesurées : chaque contexte a un
     `<context>.routes.spec.ts` qui tient sa liste de routes (deux routes ne répondent jamais à
     la même méthode et au même chemin, ni ne partagent un identifiant d'opération).
     `generate context` écrit désormais cette *spec*.
   - `grant-delegation.route.ts` : aucune *spec* n'envoyait une délégation sans fin. Ajoutée :
     « hands the use case a delegation without an end when the client gives none ».

### Taux au 2026-10-10 (instructions, branches, fonctions, lignes, en %)

| Contexte | Couche | Instructions | Branches | Fonctions | Lignes |
|---|---|---|---|---|---|
| analytics | domaine | 100,00 | 100,00 | 100,00 | 100,00 |
| analytics | application | 100,00 | 100,00 | 100,00 | 100,00 |
| analytics | présentation | 100,00 | 100,00 | 100,00 | 100,00 |
| analytics | infrastructure | 98,33 | 85,71 | 100,00 | 98,28 |
| identity | domaine | 100,00 | 100,00 | 100,00 | 100,00 |
| identity | application | 100,00 | 100,00 | 100,00 | 100,00 |
| identity | présentation | 100,00 | 100,00 | 100,00 | 100,00 |
| identity | infrastructure | 100,00 | 89,58 | 100,00 | 100,00 |
| notification | domaine | 100,00 | 100,00 | 100,00 | 100,00 |
| notification | application | 100,00 | 100,00 | 100,00 | 100,00 |
| notification | présentation | 100,00 | 100,00 | 100,00 | 100,00 |
| notification | infrastructure | 98,32 | 83,33 | 100,00 | 98,31 |
| scheduling | domaine | 99,37 | 96,95 | 99,08 | 99,34 |
| scheduling | application | 99,76 | 98,68 | 100,00 | 99,76 |
| scheduling | présentation | 100,00 | 94,44 | 100,00 | 100,00 |
| scheduling | infrastructure | 100,00 | 92,06 | 100,00 | 100,00 |

Ces taux disent que le code a tourné sous une *spec*. Ce que les *specs* affirment est une autre
affaire, tenue par leurs noms et par les parcours de bout en bout.

### Chaque règle du kit, enfreinte une fois dans une copie de cette application

`npm run example:conformance`, à la racine du kit, copie cette application dans un répertoire
temporaire, installe le kit dans la copie comme le ferait un registre, et pour chacun des 67
identifiants de règle du catalogue écrit une violation minimale et lit ce que dit l'outil qui
porte la règle : `ddd-ts-kit check`, ESLint avec le preset, Biome. Une règle tenue à la fois par
le *checker* et par ESLint doit être signalée par les deux, sur le fichier qui l'enfreint, sans
rien d'autre à côté que les compagnons que le cas déclare. La copie intacte n'a rien à signaler
au *checker*, à ESLint, à Biome, à dependency-cruiser, à knip ni au vérificateur de types. Aucune
règle n'est déclarée non applicable à cette application. La suite échoue quand une règle du
catalogue n'a pas de cas, donc une règle ajoutée au kit est appliquée ici ou le *pipeline* le
dit. Elle tourne en 40 secondes environ, après la porte de cette application, dans
`npm run example:verify`.

### Dérogations de cette application, revues

Trois entrées, une décision : `application/projections` est un répertoire supplémentaire de
`scheduling`, de `notification` et d'`analytics` (ADR 0002). Toujours nécessaire : le noyau a un
rôle `@Projection` et l'arborescence canonique du *checker* ne connaît pas son répertoire. La
condition de retrait de l'enregistrement est inchangée. Aucune règle n'est abaissée, aucun
*package* n'est ajouté à une liste d'autorisation, aucune source ne porte de désactivation ni de
commentaire d'exclusion de la couverture.

### Limites

- Le verrou des générateurs de `scripts/kit.mjs` a quitté le répertoire temporaire du système,
  qui n'en garde plus aucune trace, pour le répertoire d'état du script.
- Les *specs* de bout en bout ne sont pas mesurées : une route atteinte seulement de bout en
  bout compte comme non couverte.

## 2026-10-10 : l'alias devient `@/`, déclaré sous les `paths` de tsconfig et réécrit au build

La section « chaque import par son alias (subpath imports de Node) » ci-dessus est gardée telle
qu'elle a été écrite : elle décrit le mécanisme de ce jour-là, un subpath import préfixé par `#`
déclaré dans `package.json` et résolu par Node sous une condition de résolution. Le propriétaire
du kit a rejeté cette graphie au profit de `@/`, sans segment `src`. Node ne sait pas résoudre
`@/` seul, donc le mécanisme a changé : l'alias est déclaré sous `paths` dans `tsconfig.json`, et
le build se termine par `ddd-ts-kit build-aliases`, qui réécrit chaque alias de `dist/` en chemin
relatif.

Ce qui a été fait ici, dans l'ordre :

1. Le préfixe de chaque import par alias, remplacé sur place : 2101 spécificateurs dans 561
   fichiers (2023 sous `src/`, 73 sous `test/`, 5 sous `scripts/`) ; 2055 nomment la racine des
   sources par `@/` et 46 nomment les tests par `$test/`. `npx eslint . --fix` n'a ensuite
   changé aucun fichier : la correction automatique d'`imports/alias-only` réécrit un import
   relatif, et il n'en restait aucun. `npm run format` a remis en forme 7 fichiers, puisque le
   préfixe est plus court de trois caractères.
2. À la main, les déclarations qu'`init` écrit pour un nouveau projet : `importAlias` `@/` dans
   la configuration, `paths` dans `tsconfig.json`, le champ `imports` retiré de `package.json`,
   la condition de résolution retirée du script `dev` et des deux configurations de vitest, qui
   positionnent désormais `resolve: { tsconfigPaths: true }`, et `build` qui enchaîne
   `node scripts/kit.mjs build-aliases` après le compilateur.
3. `node scripts/kit.mjs depcruise-config --write` : la configuration du graphe générée ne nomme
   plus de condition et lit `tsconfig.json`.
4. `migrations/0001_initial.js` nomme de nouveau le schéma compilé par `../dist/src/...` : la CLI
   de knex le lance sous le `node` simple, et rien ne réécrit un fichier JavaScript à la racine
   du projet.
5. `npm run docs:generate` n'avait rien à réécrire : les barrels étaient déjà ce qu'écrit le
   générateur sous le nouvel alias.

`$test/` et `$scripts/`, pas `@test/` et `@scripts/` : un nom tel que `@test/x` est aussi le nom
que peut porter un *package*, et l'on a mesuré que dependency-cruiser résout un *package* installé
de ce nom avant le fichier du projet. `$` ne peut pas figurer dans un nom de *package*
([les alias d'import](../../../docs/tools/import-aliases.fr.md)).

Vérifié ensuite : `npm run verify` (types, lint, format, 1290 *specs* unitaires et d'adaptateurs
avec les seuils de couverture, 57 *specs* de bout en bout, le *checker* avec 0 constat dans 724
fichiers, dependency-cruiser sur 763 modules, knip, `docs:check`), puis les 67 identifiants de
règle de la suite de conformité. Le build réécrit 800 spécificateurs dans 247 des 467 fichiers
émis ; le `node` simple lie chaque module compilé et démarre `dist/src/main.js` et le *worker*
jusqu'à leur configuration sur Node 24.21 (`alias-example.spec.ts`, que la CI lance aussi sur
Node 22). Le démarrage complet avec les services de compose n'a pas été rejoué.

Frictions :

1. **Un build se fait désormais en deux étapes.** `tsc` seul laisse les alias dans `dist/`, qui
   s'arrête alors sous `node` à son premier import. `imports/alias-declared` signale un script
   qui compile sans la réécriture, et la réécriture refuse une sortie qu'elle ne peut pas
   terminer.
2. **Un alias complété à l'exécution ne peut pas être réécrit.** `scripts/events.ts` de cet
   exemple construisait déjà son chemin à partir de `import.meta.url` ; le *template* du kit non,
   et la réécriture l'a refusé sur le premier projet généré.
3. **`scripts/demo.mjs` garde trois imports relatifs** : c'est un fichier JavaScript que Node
   lance tel qu'il est écrit, hors des sources TypeScript que lit la règle.
4. **`docs/demo-transcript.md` et `docs/tooling/` sont des enregistrements** faits avant ce
   changement et ont été laissés tels qu'enregistrés.

## 2026-10-12 : des imports sans l'extension `.js`

Le propriétaire du kit préfère un import qui nomme son fichier et rien d'autre :
`@/contexts/identity/domain/repositories/person.repository`, pas `.../person.repository.js`. Le
kit a désormais un réglage pour cela, `importExtension` (`none` ou `js`), `none` pour un nouveau
projet, et une configuration sans la clé est lue comme `js`. Cette application a été migrée avec
les outils qu'utiliserait une équipe, dans l'ordre que donne le *checker* :

1. `"importExtension": "none"` ajouté à `ddd-ts-kit.config.json`, à la main. `ddd-ts-kit check`
   a alors signalé 2106 constats, et chacun disait quoi faire : 2101 `imports/extension` (un par
   import, dans 561 fichiers), 4 `declarations/barrel-current` (les barrels ne correspondaient
   plus à ce qu'écrit le générateur) et 1 `imports/alias-declared` sur `tsconfig.json`.
2. `tsconfig.json`, à la main, comme le dicte ce dernier constat : `"module": "ESNext"`,
   `"moduleResolution": "Bundler"`, `"customConditions": ["node"]`.
3. `npx eslint . --fix`, 45 secondes : la correction automatique d'`imports/extension` a réécrit
   les 2101 imports (2023 sous `src/`, 73 sous `test/`, 5 sous `scripts/`), les quatre barrels
   compris, puisqu'un barrel est un fichier de lignes `export * from`.
4. `npm run format` à la racine du dépôt : 4 fichiers modifiés dans toute l'arborescence, là où
   une instruction tient de nouveau sur une ligne maintenant que son spécificateur est plus
   court de trois caractères.
5. `npm run build` à la racine, puis `npm run docs:generate` ici : `ddd-ts-kit docs` a répondu
   « Nothing to do » (la correction avait déjà écrit les barrels comme le fait le générateur),
   et les documents OpenAPI et AsyncAPI sont sortis identiques.
6. `CLAUDE.md` et la section « Imports » du README, à la main, tels qu'`init` les écrit
   désormais.

Rien d'autre n'a changé : aucun fichier sous `migrations/` (le JavaScript que Node lance tel qu'il
est écrit garde son `.js`), aucun script, aucune configuration de test (`vitest` lit les `paths`,
qui complètent l'extension), ni `scripts/events.ts`, dont l'unique `index.js` est un chemin de la
sortie compilée construit à partir de `import.meta.url`.

Vérifié ensuite : `npm run verify` (types sous la résolution bundler, lint, format, 1290 *specs*
unitaires et d'adaptateurs avec les seuils de couverture, 57 *specs* de bout en bout, le
*checker* avec 0 constat dans 724 fichiers, dependency-cruiser sur 763 modules et 3429
dépendances, knip, `docs:check`), puis chaque identifiant de règle du kit enfreint une fois dans
une copie de cette application (75 *specs*, dont la nouvelle `imports/extension`, écrite dans la
graphie que la configuration de l'exemple ne demande pas). Le build réécrit toujours 800
spécificateurs dans 247 des 467 fichiers émis, et complète désormais chacun avec `.js` ; le
`node` simple lie chaque module compilé et démarre `dist/src/main.js` et le *worker* jusqu'à leur
configuration sur Node 24.21 (`alias-example.spec.ts`, que la CI lance aussi sur Node 22). Zéro
import d'un fichier du projet ne se termine par `.js`, `.ts` ou `.mjs` sous `src/`, `test/` et
`scripts/`, sur 2101.

Frictions :

1. **Le compilateur ne refuse plus l'ancienne graphie.** Sous la résolution bundler,
   `.../person.repository.js` passe toujours la vérification des types. Seuls
   `imports/extension` (*checker*, ESLint) puis le build la refusent, donc un projet qui
   désactive la règle perd la graphie unique.
2. **Le compilateur ne modélise plus Node pour les *packages*.** Un import par défaut d'un
   *package* CommonJS que Node livre sous la forme `{ default }` passe la vérification des types
   sous `Bundler` et échoue à l'exécution ; cette application n'en a aucun, et ses *specs* comme
   la liaison de chaque module compilé le montreraient. La condition `node` est rendue au
   compilateur (`customConditions`), donc l'entrée qu'il lit dans un *package* est celle que
   charge Node.
3. **Un import peut nommer un répertoire pour le compilateur, pas pour le build.**
   `.../published-language` se résoudrait vers son `index.ts` ; le build le refuse et le
   *checker* le signale. Cette application a toujours écrit `.../published-language/index`, donc
   rien n'a eu à changer.
4. **L'exécution sur postgres et le démarrage complet avec les services de compose n'ont pas
   été rejoués** pour ce changement : `test:postgres` et `infra:up` ont besoin des services, et
   rien de ce qu'ils exercent ne lit un spécificateur d'import.

## 2026-10-12 : des dépendances dites par le constructeur, et les projections comme un rôle

La décision du propriétaire : un gestionnaire s'écrit sans répéter ses dépendances dans son
décorateur. Avant, chacune des 89 classes de cette application qui prennent quelque chose le
disait deux fois, `@CommandHandler(RegisterPersonCommand, [PersonRepository, Clock])` puis le
constructeur. Désormais le constructeur le dit une fois, et le kit le lit.

Mesuré d'abord, sur les compilateurs et lanceurs que rencontre cette application, avec une
classe décorée dont le constructeur prend deux ports : `design:paramtypes`, la métadonnée
qu'écrit `emitDecoratorMetadata`, est présente sous `tsc` 6 et 7, sous Vitest 5, et sous swc
seulement avec les décorateurs hérités (legacy) ; elle est absente sous `tsx` (le script `dev`)
dans les deux modes de décorateurs, et partout avec les décorateurs standard ; et elle vaut
`Object` pour un port importé avec `import type`. Cette application est sur les décorateurs
hérités (class-validator), donc les métadonnées auraient fonctionné dans son build et ses tests
et échoué sous `npm run dev`. Le kit lit plutôt les signatures dans les sources et les écrit
dans le barrel généré de chaque contexte.

Ce qui a été fait ici, dans cet ordre, chaque étape par un outil du kit :

1. `"dependencies": "signature"` sous `stack` dans `ddd-ts-kit.config.json`.
2. `npx eslint . --fix` : la nouvelle règle `declarations/constructor-injection` a signalé 89
   listes, toutes les 89 égales à leur constructeur, aucune qui différait, et les a retirées. 89
   fichiers modifiés, une ligne chacun ; rien d'autre en eux : la correction a laissé les
   imports tels qu'ils étaient, donc les ports restent importés ici comme valeurs, ce que le code
   généré d'un nouveau projet écrit sous la forme `import type`. Les deux graphies fonctionnent : c'est le
   barrel qui importe la valeur.
3. `node scripts/kit.mjs docs` : les quatre barrels contiennent désormais 122 `export *` (118
   avant, plus les quatre projections) et 89 instructions `injected(Class, [Tokens])` avec leurs
   imports, disposées comme Biome les dispose, donc `format:check` n'a rien à dire d'un fichier
   généré.
4. Le script `dev`, à la main, tel qu'`init` l'écrit désormais :
   `--import ddd-ts-kit/dist/refresh-declarations.js`.
5. Les trois entrées `extraDirectories` et leurs trois dérogations, retirées : le *checker*
   connaît `application/projections/`. L'ADR 0002 est marqué remplacé et gardé.
6. `src/platform/compose-application.ts` ne nomme plus les quatre projections : les barrels les
   apportent.

Ce que cela a changé dans les tests :

- Neuf *specs* de gestionnaires de `scheduling` donnent désormais un *fake* à `Agenda`. Le
  barrel apporte la projection de l'agenda, qui applique les événements du domaine qu'un
  gestionnaire annonce avec sa sauvegarde : avec la projection laissée de côté, comme avant,
  ces *specs* faisaient tourner un contexte qui n'était pas celui que fait tourner
  l'application.
- Deux *specs* qui construisaient une projection seule la prennent dans le fichier généré de son
  contexte
  (`contextModule('analytics', { OutcomesProjection: analyticsDeclarations.OutcomesProjection })`) :
  une classe importée depuis son propre fichier n'a pas de liste de dépendances. Deux autres qui
  ajoutaient une projection par son nom aux déclarations ne le font plus.
- Nouvelle `test/architecture/every-class-resolves.spec.ts` : la racine de composition telle que
  `main.ts` la construit, sur PostgreSQL dans le processus, puis chaque classe déclarée des
  quatre contextes construite une par une. Une liste qui manque, d'une autre longueur, ou qui
  nomme quelque chose que personne ne lie, échoue là, par son nom.

Vérifié ensuite : `npm run verify` (types, lint, format, 1298 *specs* unitaires et d'adaptateurs
avec les seuils de couverture, 57 *specs* de bout en bout, le *checker* avec 0 constat dans 724
fichiers, dependency-cruiser sur 763 modules et 3481 dépendances, knip, `docs:check`), puis
chaque identifiant de règle du kit enfreint une fois dans une copie de cette application (76
*specs*, dont la nouvelle `declarations/constructor-injection` : un paramètre de constructeur
typé `number`).

Frictions :

1. **Un constructeur modifié à la main laisse le barrel périmé jusqu'à ce que quelque chose le
   régénère.** `check` et `docs --check` le disent et nomment la classe, `dev` régénère à chaque
   rechargement, et l'application refuse de démarrer avec une liste d'une autre longueur ; mais
   une liste de même longueur et d'autres jetons d'injection (deux ports échangés contre deux
   autres) n'est attrapée que par la porte et par la vérification des types du barrel, pas au
   démarrage.
2. **Chaque injection de la suite de conformité qui modifie un constructeur signale désormais
   aussi `declarations/barrel-current`.** Huit injections le déclarent comme compagnon. C'est
   la lecture honnête : le fichier généré fait partie de ce que touche un changement de
   constructeur.
3. **Faire entrer les projections dans le barrel a changé ce qu'assemble une *spec* de
   gestionnaire.** C'est le bon contexte, et cela a coûté un *fake* dans neuf *specs*. Une
   équipe qui migre rencontre la même chose.
4. **Un rechargement qui a réécrit le barrel peut être suivi d'un second**, pour le barrel
   lui-même, que l'observateur de fichiers surveille aussi. Il ne trouve rien à réécrire. Non
   mesuré ici : la preuve pour `dev` porte sur un projet généré (`dev-reload.spec.ts` de la
   CLI), pas sur cette application, dont le démarrage a besoin de ses services.
5. **Le démarrage complet avec les services de compose et l'exécution sur postgres n'ont pas
   été rejoués** pour ce changement : `infra:up` et `test:postgres` ont besoin des services.

## 2026-10-12 : des erreurs construites par une fabrique de leur concept

La décision du propriétaire : le code qui refuse se lit comme une phrase, et les erreurs d'un
même concept vivent ensemble. `throw new SlotTakenError(calendar.id, slot.startsAt)` est devenu
`throw AppointmentError.slotTaken(calendar.id, slot.startsAt)`.

| | Avant | Après |
|---|---|---|
| classes d'erreurs (`domain/errors/*.error.ts`) | 44 fichiers, 400 lignes | 8 fichiers, 293 lignes |
| leurs *specs* (`test/unit/*.error.spec.ts`) | 44 fichiers, 541 lignes | 8 fichiers, 458 lignes |
| refus | 44 classes, un code chacune | 44 fabriques sur 8 classes, les mêmes 44 codes |
| endroits qui en construisent un | 164 `new ...Error(..)` | 164 appels de fabrique |
| faits qu'un test peut lire comme des données | les paramètres gardés comme propriétés, sur 16 classes | chaque paramètre, sur chaque refus |
| faits qu'un client peut lire comme des données | aucun (seulement le message) | 11 refus en exposent un, par son nom |

Les concepts viennent des glossaires, un par agrégat : `PracticeError` (8 refus),
`DelegationError` (4), `PersonError` (3) dans identity ; `AppointmentError` (13),
`CalendarError` (10), `WaitlistError` (3) dans scheduling ; `NotificationError` (2),
`ReminderError` (1) dans notification. Un refus va au concept que l'appelant a demandé : le
calendrier et le planificateur détectent qu'un créneau est occupé, et refusent avec
`AppointmentError.slotTaken`. Les refus d'un objet-valeur vont au concept qu'il décrit :
`PersonError.invalidEmail`, `CalendarError.invalidRange`. Aucun objet-valeur n'a de classe
d'erreur à lui, et aucune n'aurait pu s'appeler `RangeError`.

Comment cela a été fait, dans cet ordre :

1. `ddd-ts-kit error-factories --plan` a proposé un concept pour 15 des 44 classes, celles
   nommées d'après un agrégat (`AppointmentNotFoundError`, `UnknownCalendarError`). Les 29 autres
   ont reçu le leur à la main dans le fichier du plan : c'est la décision du modèle.
2. `ddd-ts-kit error-factories --apply` a écrit 101 fichiers et en a retiré 88 : les 8 classes
   d'erreurs, chaque fabrique avec les paramètres et le message du constructeur qu'elle remplace
   et ses paramètres simples comme faits ; les 8 *specs*, les cas de chaque ancienne *spec* sous
   le nom de sa fabrique ; et chaque usage, dont les assertions sur une classe, changées en
   assertions sur un code (`toThrow(OutsideAvailabilityError)` devient
   `toThrow(expect.objectContaining({ code: 'OUTSIDE_AVAILABILITY' }))`). Il a positionné
   `"stack.refusals": "factories"`. Puis `npm run format`.
3. À la main : les faits qu'un client peut lire (`startsAt` d'un créneau, `notice`, `horizon`,
   `grid`, `limit`, le `status` d'un rendez-vous terminé, `held`, le `day` et le `endsAt` qui ont
   été envoyés), jamais un identifiant de personne ; les 8 *specs* réécrites sous la forme d'une
   table par classe qui affirme le code, le message, les faits et les faits exposés de chaque
   fabrique ; une *spec* qui lisait `error.given`, désormais
   `expectRefusal(result, 'INVALID_NOTIFICATION_KIND', { given })`.

Ce que les outils ont dit :

- La première exécution du codemod a envoyé `UnknownTimeZoneError` de scheduling vers
  `PracticeError`, le concept de la classe du même nom dans identity : un déplacement était
  appliqué par nom de classe à travers tout le projet. La vérification des types l'a attrapé
  dans un fichier. Le codemod applique désormais un déplacement aux fichiers de son propre
  contexte, et ailleurs aux fichiers qui importent la classe depuis là ; un test le tient.
- Une assertion écrite sur trois lignes, `toThrow(\n  OutsideAvailabilityError,\n)`, a d'abord
  été laissée au dernier passage, qui l'a changée en `toThrow(AppointmentError)` : une assertion
  plus faible, verte. Les motifs acceptent désormais une virgule finale, et une classe laissée
  comme valeur est signalée.
- Le contrat HTTP n'a pas bougé : `openapi/openapi.json`, régénéré, diffère du précédent par
  cinq lignes ajoutées, le membre facultatif `facts` du schéma `Problem`. Chaque chemin, statut
  et liste `x-error-codes` est le même, et les *specs* de bout en bout n'ont pas été modifiées.
- Le `CONTEXT.md` des trois contextes a gagné une table `Errors` : classe, refus, code, faits
  exposés.

Laissé tel quel, exprès :

- Dix fabriques prennent encore une phrase : `CalendarError.invalidRange(rule)`,
  `AppointmentError.invalidSlot(reason)`. Le message est écrit par l'appelant, comme avant.
  Chacune est candidate à une fabrique par règle, ce qui ne changerait rien pour un client
  (même code) et serait un changement du modèle, pas de la forme.
- `UNKNOWN_TIME_ZONE` est défini dans identity et dans scheduling. Un code est unique dans son
  contexte ; les deux reçoivent la réponse 422 de l'unique *mapper* d'erreurs.
- `LAST_MANAGER` a gardé son code et sa fabrique est `PracticeError.lastManager()` : la classe
  était `PracticeLeftUnmanagedError`, dont le nom disait autre chose que son code.

Le même jour, les ports et les types du noyau que cette application n'utilise que comme types
sont importés avec `import type` (114 instructions d'import dans 78 fichiers), comme les écrivent
les *templates*. Les déclarations générées n'ont pas changé : le lecteur de signatures suit un
import de type jusqu'à la classe qu'il nomme, et le fichier généré importe la valeur.

## 2026-10-12 : des routes en classes de contrôleurs, derrière des groupes de routes et des gardes

Les 24 routes des quatre contextes et la route d'audit de la plateforme sont devenues des classes
de contrôleurs, avec `ddd-ts-kit controllers` puis à la main pour ce que la commande laisse à une
personne.

| | Avant | Après |
|---|---|---|
| Forme d'une route | fonction `defineRoute`, listée dans `<context>.routes.ts` | classe portant `@Controller`, une méthode, aucune liste |
| Fichiers sous `presentation/http/` et la route d'audit | 90, à plat (61 dans `scheduling`) | 98 : un dossier par route, 9 fichiers de groupes, 1 *mapper*, 2 sérialiseurs |
| Lignes de ces fichiers | 1967 | 1910 |
| Listes de routes tenues à la main | 4, et leurs 4 *specs* | 0 |
| Groupes de routes | aucun | 9 : `people`, `practices`, `practice-opening` (identity), `appointments`, `calendars`, `practices` (scheduling), `notifications`, `practices` (analytics), `audit` (plateforme) |
| Lignes des *specs* de routes ou de contrôleurs | 1937 | 2088 |
| `openapi/openapi.json` | | identique octet pour octet |
| *Specs* de bout en bout | 57 passent | 57 passent, sans modification, arbres de *spans* compris |

Ce qu'a fait la commande : les 24 contrôleurs, les 8 groupes des contextes (chacun derrière
`Authenticated`, avec `FORBIDDEN` dit une seule fois), les 61 fichiers de schémas déplacés sous
leur route ou sous `shared/`, chaque import réécrit, les 24 *specs* déplacées, les 4 listes,
leurs *specs* et leurs lignes dans la racine de composition retirées. Ce qui a été fait à la
main : la ligne qui monte les contrôleurs déclarés et le contrôleur d'audit dans
`compose-application.ts`, deux *specs* d'intégration qui nommaient la liste des routes, une
*spec* dont l'appel s'étendait sur plusieurs lignes, le contrôleur d'audit (hors des
contextes), et la clé de configuration, que la commande laisse tant qu'il reste une route écrite
en fonction (`defineRoute`).

Deux groupes demandent un rôle en bordure, `HasRole('platform-admin')` :
`PracticeOpeningRoutes`, qui affine `PracticesRoutes` d'identity, et `AuditRoutes`. Les
permissions `identity:practice.open` et `audit:trail.read` sont inchangées sur leurs cas
d'usage. Un appelant sans le rôle est désormais refusé avant le bus : le statut et le code sont
les mêmes, et le journal d'audit n'enregistre plus de décision refusée pour lui, puisqu'aucune
décision n'a été demandée. `BookAppointmentController` a un *mapper* de requête HTTP,
`GetCalendarDayController` un sérialiseur, et les deux recherches de l'agenda partagent
`AgendaEntrySerializer`, ce qui a retiré une fonction dupliquée. Six contrôleurs gardent encore
une petite fonction auxiliaire sous leur classe (`grant-delegation`, `search-occupancy`,
`reschedule-appointment`, `search-notifications`, `join-waitlist`, `get-appointment`) : chacune
est un *mapper* ou un sérialiseur à extraire.

Aucune route de l'application n'est publique, donc `Public` n'est pas montré ici : le kit le tient
dans ses propres *specs*. `PersonError.invalidEmail` cite dans son message l'adresse qu'il
refuse : le client lit désormais `Invalid email.` comme `detail`, et la *spec* du contrôleur
tient que l'adresse ne sort pas.

## 2026-10-13 : un agrégat gardé sous forme de ses événements

Le kit a gagné l'*event sourcing*, choisi agrégat par agrégat. L'exemple le montre sur un agrégat
dont l'historique est le métier, le registre de présence d'un patient dans un cabinet : les
absences et les annulations du patient, chacune notée une fois, dans l'ordre. Tous les autres
agrégats gardent leur état dans des tables, dans le même contexte et la même transaction.

| | |
|---|---|
| Agrégat en *event sourcing* | `AttendanceRecord` (scheduling), trois événements : `created`, `no-show-noted`, `cancellation-noted` |
| Comment il est alimenté | les gestionnaires avant validation de `scheduling.appointment.marked-no-show` (nouveau) et de `scheduling.appointment.cancelled` (une annulation par le patient) envoient `NoteNoShow` et `NoteCancellation`, en tant qu'acteur système `scheduling.note-attendance` : le flux est complété dans l'unité de travail du rendez-vous |
| Store | PostgreSQL à travers knex, dans le schéma `scheduling` (`createEventStoreTables` dans `createSchedulingTables`), lié par la plateforme ; en mémoire pour les *specs* de gestionnaires |
| *Snapshots* | tous les 20 événements, prouvés égaux à un rejeu complet (`expectSnapshotEquivalence`) |
| Données personnelles | les mots d'un patient qui annule sont scellés avec la clé du patient ; un patient effacé lit `[erased]` après une reconstruction |
| Projection | `scheduling.attendance-history`, alimentée par le store (`{ feed: 'event-store' }`) : un abonnement de rattrapage dans le processus de l'API, au rythme du relais de l'outbox ; sa reconstruction depuis la position zéro est prouvée sur PostgreSQL |
| Contrat HTTP | seulement additif : `GET /practices/{practiceId}/patients/{patientId}/attendance` (`searchAttendanceHistory`), et les permissions `scheduling:attendance.note`, `scheduling:attendance.read` (la seconde demandée à un cabinet, comme `work`) |
| Exécutions de générateurs | 11, journalisées dans `docs/tooling/generator-log.jsonl` ; 2 refusées |
| Formes stockées enregistrées | `node scripts/kit.mjs docs --stored-events` : `stored-events.lock.json` |

Ce qu'ont fait les générateurs : `generate aggregate --event-sourced` a écrit l'agrégat, son
événement de naissance, le codec de ses événements stockés, un *builder* qui rejoue un historique
et une *spec* « étant donné des événements » ; `generate domain-event` a ajouté chaque événement
suivant à l'union, à `appliers()` avec une méthode d'application vide, et au codec ; les
commandes, le gestionnaire d'événement, la requête et le contrôleur sont venus de leurs types
comme d'habitude.

Frictions, pour le propriétaire du kit :

1. `scripts/kit.mjs` échouait sur un checkout neuf : `main()` s'exécutait avant la constante
   qu'il lit quand le répertoire de cache n'existe pas encore. Corrigé en déclarant la constante
   d'abord.
2. L'événement de naissance est `<Name>Created` : le glossaire ne tenait « Create » que pour les
   calendriers, et son sens a été élargi au registre de présence.
3. `generate projection` ne prend qu'un événement d'intégration : la projection du store,
   faite d'événements du domaine, a été écrite à la main.
4. `generate repository` n'a pas de forme *event sourcing* : le port, l'adaptateur sur
   `EventSourcedRepository` et le *fake* ont été écrits à la main, environ 70 lignes.
5. `generate query` sans `--search` a encore écrit un port de lecteur, son adaptateur en mémoire
   et son *fake* ; la requête lit le store de la projection, et les trois fichiers ont été
   retirés.
6. Trois *specs* existantes accordent au rôle `system` les permissions des commandes que le
   contexte s'envoie à lui-même : chacune a eu besoin d'`attendance.note`, puisqu'annuler un
   rendez-vous ou le marquer note désormais la présence dans la même unité de travail.
7. Les *specs* d'intégration, lancées en parallèle sur vingt cœurs à côté d'autres charges, ont
   dépassé leur délai pendant le démarrage de PGlite (une limite de *hook* de 10 s) ; elles
   passent en série et avec quatre *workers*.

### 2026-10-13, après revue : les portes des formes stockées, un effacement

Une revue du lot a trouvé que le verrou des formes stockées ne tenait qu'à la mémoire, et qu'il
n'y avait aucun moyen de lancer l'effacement que prescrit la documentation. Ce qui a changé dans
l'exemple :

| | |
|---|---|
| Formes stockées | `npm run docs:check` (`ddd-ts-kit docs --check`) échoue désormais tant qu'une version déclarée dans un codec n'est pas enregistrée dans `stored-events.lock.json` ; l'empreinte d'une forme inclut les types du codec qu'elle atteint |
| Personne concernée | l'événement d'annulation porte le patient dont il scelle la raison (`cancelled.patientId`), au lieu de le lire dans l'identifiant du registre ; la partie cabinet de cet identifiant est échappée, donc deux paires n'en partagent jamais un |
| Effacement | `npm run erase:patient -- <patientId>` : la clé est détruite, puis chaque projection alimentée par le store est reconstruite |
| Rattrapage | un battement qui survient pendant un tour en cours est sauté ; un point de reprise déplacé d'abord par un autre réplica est un tour sauté, pas une erreur |

Frictions, pour le propriétaire du kit :

1. La forme de `scheduling.attendance-record.cancellation-noted` a changé en version 1, qui
   était enregistrée mais jamais stockée hors des tests et n'est pas fusionnée : sa ligne a été
   retirée du verrou et enregistrée de nouveau, le chemin que décrit
   `docs/concepts/event-sourcing.md`. Une fois fusionné, le même changement est une version 2
   avec son *upcaster*.
2. `docs --check` a signalé tout de suite la version non enregistrée, avec la commande à
   lancer : la porte a fait ce que la revue lui demandait.
3. Le rattrapage et la reconstruction d'une projection alimentée par le store sont encore écrits
   à la main dans la plateforme (`store-fed-projections.ts`) : `generate projection` n'a pas de
   forme pour l'event store.

## 2026-10-13 : des documents de rendez-vous, gardés dans le stockage de fichiers

Un cabinet joint un document à un rendez-vous (une lettre d'orientation, une ordonnance, un
compte rendu), un patient ou le cabinet le récupère par un lien valable cinq minutes, et le
cabinet le retire. Le contenu n'atteint jamais la base de données : le rendez-vous garde la
référence du fichier stocké (clé, taille, type de média, somme de contrôle), son nom et le moment
où il a été joint.

| | |
|---|---|
| Configuration | `"storage": "local"` : un répertoire en développement (`.data/files`), et dans le parcours de bout en bout et la *spec* d'intégration de la tranche, chacun dans un répertoire temporaire ; la mémoire dans les *specs* de gestionnaires. MinIO dans `docker-compose.yml` derrière le profil `files` est une recette pour passer à un stockage objet (le commentaire du service en donne les étapes), pas un stockage sur lequel tourne l'exemple |
| Plateforme | ce qu'`init --storage local` écrit pour cette *stack* (`platform/files/`, `platform/config/read-files.ts`, les routes de fichiers montées avant `express.json()`, le lecteur de téléversements de la bordure HTTP, la purge des fichiers en transit toutes les heures), appliqué comme la différence entre `init --storage none` et `init --storage local` de la même *stack*, puisque `init --force` aurait réécrit les fichiers de la plateforme réglés à la main |
| Générateurs | `generate value-object` (`AttachedDocument`), deux `generate error` (`noDocument`, `documentNameTooLong`), `generate file-upload`, `generate command`, `generate query`, deux `generate route`, puis `docs` |
| Écrit ou réécrit à la main | l'objet-valeur, les deux refus, l'état et deux méthodes d'`Appointment`, les six colonnes du *mapper*, la migration `20261013090000_add-appointment-documents.js` et `upgradeTables` pour la base de données dans le processus des tests, les trois gestionnaires, les trois contrôleurs, les *specs*, le parcours de bout en bout |
| Routes ajoutées | `POST`, `GET` et `DELETE` `/appointments/{appointmentId}/document` ; le reste d'`openapi/openapi.yaml` est inchangé (228 lignes ajoutées, aucune retirée) |
| Audit | `scheduling:appointment.read-document` est une permission sensible d'`auditDecisions` : chaque lecture autorisée d'un document est enregistrée |
| Tests | 23 *specs* unitaires de la tranche, l'aller-retour de la référence dans le contrat des deux *repositories* de rendez-vous, `document-lands-with-its-file.spec.ts` sur la base de données dans le processus et le stockage local (la ligne et le fichier arrivent ensemble ; une validation refusée après le déplacement du fichier le renvoie dans `staging/` et laisse la ligne sans document), et `test/e2e/journey-documents.e2e.spec.ts` sur le stockage local : un téléversement transmis en flux par le lecteur multipart, le fichier sous sa clé finale sur le disque, un téléchargement par le lien, un 415 pour un fichier déguisé, un 403 pour un autre patient, le lien qui cesse de répondre et le fichier disparu une fois le document retiré |

Après la revue du lot, l'ordre d'une écriture a changé dans le kit, et ici avec lui. La commande
porte un `FileUpload` (`new FileUpload(file, 'appointment-documents')`), que le bus de commandes
met en transit après la permission et avant que l'entrée d'audit ouvre la transaction
(`platform/files/staging-uploads.ts`, tel qu'`init` l'écrit désormais) : aucune transaction
n'attend un client qui téléverse lentement. Le gestionnaire lit `command.document.file` et
appelle `promoteOnCommit`, qui déplace le fichier dans la transaction, comme dernière étape, donc
une ligne validée ne pointe jamais dans `staging/` et la purge horaire ne rencontre que des
orphelins. Un comportement a bougé : un téléversement vers un rendez-vous qui n'existe pas est
désormais reçu, puis laissé dans `staging/` pour la purge, puisque le gestionnaire qui trouve le
rendez-vous tourne après la mise en transit. En production, `FILES_PUBLIC_URL` est désormais
obligatoire, comme `FILES_SIGNING_SECRET`.

Ce que les générateurs n'ont pas su faire, à changer dans le kit :

- `generate file-upload` écrit un contrôleur sans le schéma de ses paramètres de chemin : un
  document joint à un rendez-vous a besoin d'`appointmentId`, écrit à la main avec son schéma de
  classe. La commande qu'il écrit ne porte que le fichier ; l'identifiant de l'agrégat a été
  ajouté.
- `generate query` a écrit un port de lecteur, son adaptateur en mémoire et son *fake* : cette
  requête lit l'agrégat et signe un lien, donc les trois fichiers ont été retirés.
- `scripts/kit.mjs` de cet exemple échouait sur tout générateur qui crée un fichier
  (`NOT_A_FILE` était déclaré après l'appel qui le lisait) ; corrigé ici.
- Les *specs* d'intégration de cet exemple dépassent leur délai quand vitest lance leurs
  fichiers en parallèle sur une machine chargée (PGlite par fichier) ; `npm run test:postgres`
  les lance un fichier à la fois, et passe.

## 2026-10-13 : les refus en bordure dans le journal d'audit, et la multitenance de l'application

Deux changements du kit ont atteint cette application.

**Un appelant refusé par une garde laisse une décision refusée.** La section précédente le
notait : puisque `PracticeOpeningRoutes` et `AuditRoutes` demandent `HasRole('platform-admin')`
en bordure, un appelant sans le rôle était refusé avant le bus, et le journal n'enregistrait plus
rien, puisqu'aucune décision n'était demandée. Le *pipeline* HTTP signale désormais chaque refus
d'une garde à `onGuardRefusal`, et `auditGuardRefusals` de `@ddd-ts-kit/audit` l'enregistre :
catégorie `authorization`, action `http:<operationId>`, issue `denied`, le code du refus comme
raison, et l'acteur, la session et la corrélation de la requête HTTP. Trois fichiers ont changé
ici, tels qu'`init` les écrit désormais : `audit/create-audit.ts` (le *hook*, à côté de
`decisions`), `auth/http-boundary.ts` (`refusals` en entrée, `onGuardRefusal` en sortie) et
`compose-application.ts` (le *hook* construit à partir de l'`AuditTrail`, de la `Clock` et de
l'`IdGenerator` liés). `identity-open-practice.e2e.spec.ts` tient désormais que le refus d'une
personne qui n'est pas administratrice de la plateforme est dans le journal, sous
`http:openPractice`.

**La multitenance de cette application est proposée, pas encore décidée.** Le kit peut désormais
confiner chaque instruction SQL à un *tenant* (`"stack.tenancy": "shared-table"`, la sécurité au
niveau des lignes, un schéma ou une base de données par *tenant*). Ici les données sont groupées
par cabinet, mais un cabinet n'est pas un *tenant* : un patient réserve dans plusieurs cabinets
avec un seul compte et liste ses rendez-vous à travers eux, et la frontière entre cabinets est le
modèle de relations, décidé élément par élément, qui restreint chaque recherche. L'ADR-0003 le
propose ; le propriétaire avait demandé une multitenance explicite et imposée, donc
l'enregistrement reste `proposed` jusqu'à ce que le propriétaire choisisse entre lui et un réseau
comme *tenant* sur des tables partagées. D'ici là, la configuration ne dit rien de la
multitenance, donc la nouvelle règle `tenancy/scoped-statement` n'a rien à juger : c'est l'unique
entrée de `NOT_APPLICABLE` de la suite de conformité, avec cette raison, et le kit prouve la
règle dans les deux sens dans ses propres *fixtures* et sur les *stacks* à tables partagées de sa
matrice de bout en bout.

Vérifié ici : la vérification des types de l'application et `ddd-ts-kit check` (0 constat dans
657 fichiers). Les *specs* de bout en bout, `npm run verify` et l'exécution de conformité ont été
laissés au *pipeline* de la *pull request*, qui les lance sur un clone neuf.

Frictions :

1. **Un refus en bordure est enregistré hors de l'unité de travail de toute commande.** Il est
   écrit quand la réponse est construite, après la fermeture de la portée de la requête HTTP :
   l'entrée porte le contexte d'exécution que le *pipeline* transmet, pas celui que le journal
   lit dans la portée. Mêmes faits, autre chemin ; un projet qui écrit son propre *hook* doit
   utiliser `GuardRefusal.execution`.
2. **Le *tenant* du jeton du realm n'est pas le cabinet.** La *claim* `tenant_id` nomme toujours
   la chaîne du journal d'audit d'un acteur ; un lecteur qui s'attend à ce qu'elle borne ce que
   voit un utilisateur sera surpris. L'ADR-0003 dit plutôt où est la frontière.

## 2026-10-13 (plus tard) : ce qu'une revue de la multitenance a changé ici

Une revue de la multitenance du kit a trouvé des trous que l'application n'atteint pas, puisque
sa configuration ne dit rien de la multitenance, et deux qu'elle atteint :

- **Le refus d'un appelant sans identifiants n'est plus enregistré.** Le journal de
  `http:openPractice` garde le refus d'une personne authentifiée qui n'est pas administratrice de
  la plateforme (ce que tient `identity-open-practice.e2e.spec.ts`) ; une requête HTTP anonyme à
  laquelle on répond 401 n'écrit rien, donc le trafic non authentifié ne peut pas faire grossir
  le journal.
- **Une garde qui échoue n'est pas un refus.** Une garde de cette application qui lèverait autre
  chose qu'une `DomainError` répondrait désormais 500 et ne laisserait aucune décision refusée.

L'ADR-0003 est revenu à `proposed` : le propriétaire a demandé une multitenance imposée, et
l'enregistrement dit le contraire, donc le propriétaire décide. Rien d'autre n'a changé dans le
code de l'application.

Frictions :

1. **Un identifiant de *tenant* a désormais une grammaire** (lettres, chiffres, `_`, `-`, au
   plus 63). La *claim* `tenant_id` du realm nomme un cabinet par son identifiant, qui convient ;
   un realm dont les identifiants contiendraient un `.` serait refusé à la première requête HTTP.

## 2026-10-12 : des objets-valeurs qui lèvent leurs refus

Les objets-valeurs des quatre contextes sont passés d'un `Result` à des fabriques qui renvoient
la valeur ou lèvent une erreur, avec `ddd-ts-kit value-objects` seul :
`"stack.valueObjects": "throwing"` est positionné, et rien n'a été laissé à une personne.

| | Avant | Après |
|---|---|---|
| Méthodes qui renvoient un `Result` | 18 (17 `create`, `Booking#movedTo`) | 0 |
| `return err(..)` et ternaires `ok(..)`/`err(..)` | 25 et 3 | 28 `throw`, dont 3 après un `if` |
| `unwrap(..)` d'un objet-valeur | 168, dans des gestionnaires, des agrégats, un service du domaine, des *mappers*, des *builders* et des *specs* | 0 |
| Assertions sur un `Result` dans les *specs* | 31 (`.ok`, `toMatchObject({ ok: false, error })`, `expectRefusal(result, ..)`) | `expectRefusal(() => .., code)` et `expect(() => ..).not.toThrow()` |
| Fichiers | | 82 sources et la configuration, 389 lignes ajoutées, 498 retirées |

Le contrat HTTP n'a pas bougé : `npm run docs:generate` a réécrit `openapi/openapi.yaml` octet
pour octet, puisqu'une requête HTTP est toujours validée en bordure par son schéma avant qu'aucun
objet-valeur ne soit construit, et qu'un refus d'une fabrique atteint toujours le *mapper*
d'erreurs sous la forme de la même `ConceptError` avec le même code. Les 1004 tests unitaires
passent, en même nombre.

## 2026-10-12 : des vocabulaires fermés au lieu de chaînes magiques, et des nombres qui ont un nom

Les statuts, types et rôles des quatre contextes sont devenus des vocabulaires fermés, chacun
déclaré une fois par `ddd-ts-kit generate vocabulary` (un objet `as const` et le type union de
son nom, sous `domain/vocabularies/`), et les identifiants de permissions et les rôles du realm
de la plateforme sont lus depuis leurs déclarations. `language/declared-vocabulary` listait
chaque valeur brute avant le changement ; il n'en reste aucune.

| Vocabulaire | Contexte | Valeurs brutes remplacées |
|---|---|---|
| `AppointmentStatus` | scheduling | 71 |
| `Weekday` | scheduling | 36 |
| `OutcomeState` | analytics | 27 |
| `NotificationKindName` | notification | 20 |
| `RoleName` (le rôle d'un membre d'un cabinet) | identity | 15 |
| `ReminderStatus` | notification | 14 |
| `DelegationEndCause` | identity | 9 |
| `Role` (les rôles du realm que porte un jeton) | plateforme | 5 |
| identifiants de permissions, à travers l'ensemble de permissions de chaque contexte (`schedulingPermissions['appointment.book'].id`) | plateforme | 30 |
| Total | | 227, dans 37 fichiers |

Les types union écrits à côté des valeurs (`'requested' | 'booked' | ...` dans l'agrégat, le
port de l'agenda, le schéma de ligne, les DTO) sont devenus le type du vocabulaire ; un
`@IsIn([...])` d'un DTO lit `Object.values(AppointmentStatus)`, dans le même ordre, donc le
contrat OpenAPI est régénéré octet pour octet. La liste de deux mots de qui a annulé,
`'patient' | 'practice'`, reste une union de types littéraux : les deux mots nomment aussi un type
de ressource, une relation du modèle d'accès et un champ d'un modèle de lecture, ce qu'un
vocabulaire signalerait. Les langages publiés gardent leurs valeurs littérales : un contrat les
nomme lui-même.

`clean/no-magic-number` a signalé 8 nombres dans `domain/` et `application/`, tous dans deux
objets-valeurs : les minutes d'une heure et les deux chiffres de `HH:MM` dans `Range`, les
minutes d'une heure et les quatre chiffres d'une année dans `TimeZone`. Chacun est désormais une
constante de son module (`MINUTES_PER_HOUR`, `TWO_DIGITS`, `YEAR_DIGITS`).

## 2026-10-13 : des noms d'événements déclarés une fois, et l'inventaire des valeurs fermées

Chacun des 22 événements du domaine déclare désormais son nom une fois, `static readonly eventName =
'scheduling.appointment.expired'`, et le porte dans `readonly name = AppointmentExpired.eventName`.
Les 33 réactions qui le répétaient (26 gestionnaires d'événements et *publishers*, 7 méthodes de la
projection de l'agenda) le lisent,
`@DomainEventHandler(AppointmentExpired, { name: AppointmentExpired.eventName })` et
`@On(AppointmentExpired, { name: AppointmentExpired.eventName })`, et les 5 gestionnaires
d'événements d'intégration de `notification` lisent le type qu'ils traitent dans la déclaration de
`scheduling`, `static readonly eventType = appointmentExpiredV1.type`. Le script du catalogue des
événements résout cette référence à travers les noms qu'exportent les langages publiés :
`docs:generate` a écrit `event-catalog.md`, `asyncapi.yaml` et `openapi.yaml` octet pour octet
comme avant. Les *specs* gardent les noms écrits en toutes lettres : un test épelle ce qu'il
attend.

Avant le changement, `scheduling.appointment.expired` était écrit six fois dans les sources :
l'événement du domaine, la déclaration du langage publié, le gestionnaire d'événement, le
*publisher*, la projection de l'agenda et le consommateur dans `notification`. Il est désormais
écrit deux fois, une fois par langage : l'événement du domaine de `scheduling` et son contrat
publié, qui nomme ses propres valeurs.

Ce qui est encore une liste fermée de valeurs dans l'exemple, avec ce qui la tient :

| Catégorie | Nombre | Déclaré dans | Lu comme | État |
|---|---|---|---|---|
| Statuts et types du modèle | 7 vocabulaires, 33 valeurs | `domain/vocabularies/*.vocabulary.ts` | `AppointmentStatus.NoShow` | typé, `language/declared-vocabulary` |
| Rôles du realm | 1 vocabulaire, 3 valeurs | `src/platform/auth/role.ts` | `Role.Admin` | typé, même règle |
| Identifiants de permissions | 31 | `definePermissions` de chaque contexte | `schedulingPermissions['appointment.book']` | typé, même règle |
| Noms des événements du domaine | 22 | `static readonly eventName` de la classe de l'événement | `AppointmentExpired.eventName`, 33 réactions | typé, `events/name-format`, `declarations/role-declared` |
| Types des événements d'intégration | 14 déclarations | `type` de la déclaration du langage publié | `appointmentExpiredV1.type`, 5 gestionnaires | typé |
| Codes d'erreur | 43 | la fabrique du concept | `errors: [..]` d'une route | littéral, chacun vérifié contre une fabrique par `errors/known-code` |
| Noms de *jobs* | 3 | `@Scheduled('notification.send-due-reminders')` | répété une fois dans `systemActor(..)` du *job* | littéral deux fois par *job*, tenus égaux par `scheduling/job-name` |
| Noms de consommateurs | 5 | `{ consumer: '..' }` de `@IntegrationEventHandler` | répété une fois dans `systemActor(..)` du gestionnaire | littéral deux fois par gestionnaire |
| Autres acteurs système | 5 | `systemActor('..')` d'un gestionnaire d'événement du domaine | une fois | littéral, un seul endroit |
| Noms de projections et de politiques | 4 et 2 | `@Projection('..')`, `@Policy(.., { name })` | une fois | littéral, un seul endroit |
| Étiquettes des groupes de routes | 5 étiquettes sur 8 groupes racines | `tags: ['scheduling']` | le nom du contexte | littéral, `scheduling` 3 fois et `identity` deux fois |
| Types de ressources ReBAC | 8 | `defineSchema` de la plateforme | `{ type: 'calendar', id }` dans `@Requires`, 31 endroits | littéral, non jugé |
| Relations ReBAC | 13 | `defineSchema` de la plateforme | `relation: 'patient'` dans 2 *repositories*, 9 endroits | littéral, non jugé |
| Clés de cache | 0 | aucun | le cache est lié dans la plateforme ; aucun contexte ne lit ni n'écrit de clé | rien à déclarer |

Non fait, et pourquoi. Noms de *jobs* et de consommateurs : le décorateur d'une classe ne peut
pas lire un membre statique de cette classe sous les décorateurs standard (ses arguments sont
évalués avant que la classe existe), et `scheduling/job-name`, les listes générées et la
documentation lisent le littéral du décorateur ; la seconde copie, dans `systemActor(..)`, reste.
Les étiquettes des groupes de routes sont le nom du contexte et ne sont comparées nulle part. Les
types de ressources et les relations ReBAC sont déclarés par le schéma des relations de la
plateforme, que la couche application n'a pas le droit d'importer ; une forme typée demande un
vocabulaire que les contextes puissent lire (le noyau partagé, ou un par contexte), non décidé
dans ce changement.

La mesure des enums couvre désormais chaque compilateur que lance un projet généré, sur Node
24.21, avec un `enum` de chaînes et l'objet `as const` des mêmes valeurs, chaque fichier compilé
et exécuté :

| Compilateur | Où un projet généré le lance | `enum` | `as const` |
|---|---|---|---|
| `tsc` 6.0.3 | le build et la vérification des types (un projet Nest aussi) | accepté | accepté |
| `tsc` sous `erasableSyntaxOnly` | un projet qui l'active | refusé, TS1294 | accepté |
| Le retrait des types de Node | un fichier `.ts` lancé par `node` | refusé, `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` | tourne |
| tsx 4.23.15 (esbuild 0.28.2) | `npm run dev` | tourne | tourne |
| Oxc, à travers rolldown 1.2.13 | Vitest 5 (Vite 8.3.4) | tourne | tourne |
| SWC 1.16.13 | Jest, à travers `@swc/jest` | tourne | tourne |

SWC a été mesuré avec son build WebAssembly de la même version : le natif a refusé de se charger
sur cette machine (`ERR_SWC_NATIVE_CACHE`, une vérification de permissions de son répertoire de
cache), ce qui ne dit rien de la syntaxe. Les transpileurs acceptent les deux ; ce qui refuse
l'`enum`, c'est le sous-ensemble effaçable, que Node exécute et que `tsc` peut imposer. L'objet
`as const` tourne sur chacun d'eux, donc la décision tient.

## 2026-10-12 : un client typé du contrat

`node scripts/kit.mjs sdk` a généré `clients/api`, le *package* `scheduling-api-client`, à partir
d'`openapi/openapi.yaml`, et a câblé l'exemple : `"sdk"` dans la configuration, le *workspace*,
l'entrée `paths` du *package* dans `tsconfig.json`, knip avec la racine comme *workspace* et les
clients laissés de côté, et les scripts (`docs:generate` et `docs:check` se terminent par le
client, `ci:build` le construit). Les scripts qui appellent la CLI passent ici par
`scripts/kit.mjs`, comme les autres ; la commande laisse un script qui la lance déjà.

| | |
|---|---|
| Généré | 6 sources, 1 748 lignes, pour 25 opérations et 39 codes d'erreur ; un README de 100 lignes ; package.json et deux fichiers tsconfig |
| Durée de `sdk --check` | 0,18 s, le contrat relu depuis le YAML, sans build |
| *Specs* passées au client | les *specs* de l'inscription d'une personne et de l'ouverture d'un cabinet, et `registerPeople` et `openStaffedPractice`, avec lesquels quatre fichiers de *specs* mettent en place leurs personnes et leur cabinet : 131 lignes ajoutées, 97 retirées |
| Nouvelles fonctions d'aide | `expectAnswer` et `expectRefusal`, typées par l'issue : un statut ou un code que l'opération ne déclare pas ne compile pas (`'SLOT_TAKEN'` pour le 404 d'`openPractice` est refusé, `418` aussi) |
| *Specs* de bout en bout lancées après le changement | les deux qui ont changé, les trois parcours et la *spec* de l'ajout d'un membre, 36 tests, passent dans le processus |
| Laissé sur les fonctions d'aide HTTP | `VALIDATION_FAILED` : un corps que le contrat ne décrit pas ne peut pas s'écrire avec le client, et c'est le but ; les étapes qui attendent un autre contexte (`eventually`) |

Frictions rencontrées pendant le câblage, chacune corrigée dans le kit avant ce *commit* : Biome
dispose un package.json comme le fait npm (chaque liste dépliée), donc la commande l'écrit ainsi ;
knip, dès que package.json déclare des *workspaces*, demande que la racine soit un *workspace* à
part entière, donc la commande déplace ce que knip.json disait du projet sous
`workspaces["."]` ; `imports/alias-declared` signalait `sdk:build` comme une compilation sans
`build-aliases`, dont un client n'a pas besoin (ses sources importent en relatif), donc la règle
laisse de côté le build de `clients/` ; et le CLAUDE.md du projet disait de ne jamais ajouter
d'entrée `paths`, donc il dit désormais que la commande écrit celle de chaque client.

Les trois générateurs que le kit n'a pas retenus ont été mesurés sur ce contrat
(`docs/tools/client-sdk.md`) : aucun ne type `problem.code` par les codes que liste le contrat,
donc `expectRefusal` n'aurait pas pu être écrit sur leur sortie.

## 2026-10-13 : le client typé après sa revue

Une revue du client a trouvé ce que la première passe n'avait pas rencontré sur cet exemple.
Chaque correction a été faite dans le kit, puis `npm run docs:generate` a réécrit `clients/api` :

| | |
|---|---|
| Un 500 de l'application | levé comme `UnexpectedResponseError` avec le corps brut ; il lit désormais le document *problem*, `code` `INTERNAL_ERROR` et `requestId`, la référence que cite un appelant |
| `operations.ts` | chaque opération tient sa propre description dans sa fonction : aucune constante au niveau du module, donc deux identifiants d'opération ne peuvent jamais entrer en collision (`listItems` et `list_items` donnaient autrefois tous deux `LIST_ITEMS`) |
| `apiAs(actor)` | donnait le jeton comme un en-tête `authorization` brut ; il le donne désormais comme l'identifiant `bearer`, une fonction interrogée avant chaque requête HTTP, donc les *specs* prouvent l'authentification du client contre le vrai serveur, et il n'a plus besoin d'`await` |
| Lockfile | aucun dans ce répertoire, qui est un *workspace* du kit ; un projet npm généré est invité à lancer `npm install` quand son lockfile ne connaît pas un client |

Les deux fichiers de *specs* modifiés et les trois parcours passent de nouveau dans le processus
(30 tests).

## 2026-10-13 : des formes déclarées une fois, et quatre paires de contrat

L'exemple dit désormais `"stack.schemas": "shared"`. Le *checker*, lancé avec la nouvelle règle
`schema/no-duplicate-shape` sur l'arborescence telle qu'elle était, a signalé 17 constats, tous
de la même forme : les dix-huit classes `<use-case>.accepted.ts`, chacune `{ @IsString() id }`.
Les deux recherches de l'agenda partageaient une classe de ligne par `extends`, que la règle ne
compte pas mais que le contrat documentait deux fois. Ce qui a changé, tout à la main sauf le
fichier de schéma (`generate schema scheduling AgendaLine`) et les documents régénérés :

| | Avant | Après |
|---|---|---|
| Fichiers de schémas sous `presentation/` | 96 | 77 (18 `*.accepted.ts` et 2 `*.line.ts` retirés, `shared/agenda-line.schema.ts` ajouté) |
| Réponses d'identifiant | 18 classes, 18 copies dans le contrat | `acceptedSchema` de `@ddd-ts-kit/http`, un seul composant `Accepted` |
| Lignes d'une recherche de l'agenda | 2 classes, 2 copies de la page dans le contrat | `AgendaLine` (`classSchema(AgendaLine, { shared: true })`), un seul `AgendaLinePage` |
| `openapi/openapi.yaml` | 2781 lignes, 90 367 octets, 112 `$ref` | 2690 lignes, 87 262 octets, 133 `$ref` |
| `components.schemas` | 7 | 10 : `Accepted`, `AgendaLine`, `AgendaLinePage` ajoutés |
| Constats de `check` | 0 | 0 |

Les octets sur le réseau n'ont pas changé. Le contrat, si, là où le partage est le but : la
réponse des 18 routes de commandes est une référence à `Accepted` (`{ id }`, désormais décrit et
fermé par `additionalProperties: false`), et les deux recherches répondent une référence à
`AgendaLinePage`. Le client typé de l'exemple, réécrit par `ddd-ts-kit sdk` à partir de ce
contrat, nomme chacun d'eux une fois : `Accepted`, `AgendaLine` et `AgendaLinePage` dans
`clients/api/src/schemas.ts`.

Deux choses rencontrées en chemin. `scripts/kit.mjs` déclarait une constante sous l'appel de sa
fonction principale : tout `generate` qui créait un fichier échouait avant de lancer la CLI ; la
constante vient désormais en premier. Et la règle a attrapé une erreur dans sa propre *spec* de
bout en bout, où deux routes avaient reçu le même corps : la *spec* imbrique désormais la forme
partagée sous un champ propre dans chacune.

Les quatre paires de contrat (Express et zod, Fastify et TypeBox, Hono sur Node et zod, NestJS et
class-validator) ont chacune été générées avec deux routes partageant une forme, et tenues à zéro
constat, à leurs *specs*, à leurs *specs* de bout en bout et à un contrat à jour ; les chiffres et
la table de décision sont dans `docs/tools/contract-pairs.md` du kit.

## 2026-10-13 : les formes après leur revue, et une partie d'une forme réutilisée

La revue des schémas partagés a demandé cinq choses que l'exemple montre ou qui le tiennent :

| | Avant | Après |
|---|---|---|
| Réponses d'identifiant | 18 `Accepted` ; les deux routes de documents fusionnées depuis main répondaient leur propre `*.accepted.ts` | 20 routes sur `acceptedSchema`, les deux `*.accepted.ts` retirés |
| `startsAt`, ISO 8601 avec son fuseau | déclaré à la main dans `BookAppointmentBody`, `RescheduleAppointmentBody` et `AddTimeOffBody` | déclaré une fois dans `shared/time-span.schema.ts` (`generate schema scheduling TimeSpan`) : la route des absences répond à `TimeSpan` en entier, les deux corps de rendez-vous étendent `pickClass(TimeSpan, ['startsAt'])` |
| `openapi/openapi.yaml` (avec les trois routes de documents de main) | 2908 lignes, 149 `$ref` | 2910 lignes, 150 `$ref` |
| `components.schemas` | 10 | 11 : `TimeSpan` ajouté |
| Constats de `check` | 0 | 0 |

Les octets sur le réseau n'ont pas changé : `POST /calendars/{calendarId}/time-off` prend les
deux mêmes instants, désormais une référence à `TimeSpan` ; les corps de la réservation et du
déplacement sont documentés comme avant, `patientId` désormais listé avant `startsAt`, parce
qu'une classe dérivée déclare d'abord la propriété choisie. La règle `schema/no-duplicate-shape`
juge désormais un contexte et le noyau partagé seulement, pas deux contextes, et laisse
tranquille une forme qui porte encore un `TODO(domain)` du générateur : deux recherches générées
à la suite ne se signalent plus l'une l'autre leur ligne `{ id }`. `shared/` contient toujours
les parties `*.dto.ts` des réponses des calendriers à côté des nouveaux fichiers `*.schema.ts` :
ces classes sont des parties imbriquées d'une réponse chacune, documentées comme composants par
class-validator, et les renommer changerait leurs noms de composants dans le contrat sans aucun
gain pour le lecteur.

## 2026-10-13 : le cache HTTP, Varnish devant l'API

L'application a gagné un cache partagé devant son API, la première route publique, une lecture
privée revalidée avec un `ETag`, et une écriture conditionnée par `If-Match`.

| | |
|---|---|
| Configuration | `"httpCache": "varnish"` dans `ddd-ts-kit.config.json` |
| Exécutions de générateurs | 4 : `generate query scheduling GetOpeningHours --public`, `generate controller ... --cache public`, `generate event-handler scheduling Calendar OpeningHoursSet`, `generate e2e scheduling GetOpeningHours` |
| Nouvelle route | `GET /calendars/:calendarId/opening-hours`, publique : `public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400`, un `ETag` faible tiré de la version du calendrier, étiqueté `calendar:<id>` |
| Routes modifiées | `GET /calendars/:calendarId/days/:day` : `private, max-age=0, must-revalidate` et un `ETag` fort ; `PUT /calendars/:calendarId/opening-hours` : `If-Match` facultatif, 412 `PRECONDITION_FAILED` sur une version périmée |
| Toutes les autres routes authentifiées | répondent `Cache-Control: no-store` (refus compris), documenté dans le contrat |
| Purge | `CalendarOpeningHoursSetEventHandler`, avant la validation, demande à `CacheInvalidation` de purger `calendar:<id>` ; le relais de `main.ts` publie à travers `PurgingPublisher` et `VarnishCachePurger` |
| Infrastructure | un service `varnish` (Varnish 9.1.0) dans `docker-compose.yml`, son VCL dans `docker/varnish/default.vcl` (celui qu'écrit `init --http-cache varnish`, port du backend 54300), `VARNISH_URL` et `VARNISH_PORT` dans `.env.example` |
| Bout en bout | `test/e2e/get-opening-hours.e2e.spec.ts` : cinq *specs* dans le processus (en-têtes, 304, une purge après la commande validée et aucune pour la commande refusée, 412, un 404 qu'aucun cache ne garde), une sixième à travers Varnish quand `VARNISH_URL` est positionnée (un `HIT`, puis les nouvelles heures après la purge) ; la CI démarre Varnish pour elle |

Ce que les générateurs ont laissé à la main : le générateur de requête a écrit un port de lecteur,
son adaptateur en mémoire et son *fake*, retirés puisque les heures sont lues dans le
`CalendarRepository` (un accesseur `openingHours` sur l'agrégat) ; le contrôleur généré d'une
requête publique ne prend aucune requête HTTP et construit sa requête sans arguments, rempli à la
main ; le gestionnaire d'événement et la *spec* de bout en bout sont remplis à partir de leurs
marqueurs. Les fichiers de la plateforme (`main.ts`, la bordure HTTP, la configuration, le
fichier compose) ont été écrits à la main d'après les *templates* qu'utilise
`init --http-cache varnish`, puisqu'`init` n'est pas relancé sur cette application.

Un défaut de l'outillage propre à l'exemple a été trouvé et corrigé : `scripts/kit.mjs` lisait
`NOT_A_FILE` avant sa déclaration chaque fois qu'un `generate` s'apprêtait à créer un fichier qui
n'existait pas encore, donc chaque exécution de générateur qui créait un fichier plantait avec
une `ReferenceError` (la déclaration est passée au-dessus de `main()`).

## 2026-10-13 (plus tard) : ce qu'une revue du cache HTTP a changé ici

Une revue a trouvé les heures en cache périmées après trois des quatre changements d'un
calendrier, et le VCL généré qui gardait des réponses qu'aucune route n'autorisait.

| | |
|---|---|
| Exécutions de générateurs | 3 : `generate event-handler scheduling Calendar ExceptionAdded`, `... TimeOffAdded`, `... AppointmentTypeDefined`, remplis à partir de leurs marqueurs |
| Purge | chaque événement qui change la version d'un calendrier purge désormais `calendar:<id>` : avant, seul `CalendarOpeningHoursSet` le faisait, et après une exception, une absence ou un type de rendez-vous, Varnish servait pendant une heure au plus une version sur laquelle chaque `If-Match` construit était refusé en 412 |
| Relais | `main.ts` purge à travers `RepeatedCachePurger` (à deux secondes d'intervalle, `PURGE_AGAIN_AFTER_MS`), pour une lecture qui a chargé les heures avant la validation et atteint Varnish après la première purge |
| VCL | `docker/varnish/default.vcl`, réécrit à partir du *template* : une réponse sans `max-age` ni `s-maxage` n'est jamais gardée (le 404 d'un calendrier inconnu, une sonde), une purge vient de la machine de Varnish ou porte `VARNISH_PURGE_KEY`, un ban refusé répond 500 |
| Configuration | `VARNISH_PURGE_KEY` dans `.env.example`, dans l'environnement du service `varnish` et dans `loadConfig` (`varnishPurgeKey`, envoyé par `VarnishCachePurger`) |
| Bout en bout | `get-opening-hours.e2e.spec.ts` : un changement du calendrier autre que ses heures les purge, et une écriture faite ensuite sur la version lue réussit, dans le processus et à travers Varnish (8 *specs*, passées à travers Varnish 9.1.0 sur cette machine) ; la mise en place attend les deux purges du cabinet qu'elle ouvre |

Contrat : inchangé.

## 2026-10-13 : des *jobs* en arrière-plan, une machine à états et un gestionnaire de processus

Ce que cet exemple a gagné, et quelle part un générateur en a écrit :

| | |
|---|---|
| Le cycle de vie d'un rendez-vous | `domain/state-machines/appointment.state-machine.ts`, écrit à la main avant que `generate state-machine` existe ; l'agrégat lui demande désormais chaque statut, et `CONTEXT.md` la dessine |
| Le délai de confirmation | un gestionnaire de processus (`application/processes/confirmation-deadline.process.ts`), quatre gestionnaires d'événements et le *job* en arrière-plan de ses expirations, écrits à la main avant que `generate process` existe ; sa forme est celle qu'écrit désormais le générateur |
| Le vidage d'un calendrier (*clearance*) | `generate command` (`ClearCalendar`), `generate query` (`GetClearance`) et deux fois `generate route` ont écrit les squelettes ; le *job* en arrière-plan a été écrit à la main |
| Stores | les *jobs* et les instances de processus dans le schéma `messaging` de PostgreSQL (`KnexJobStore`, `KnexProcessStore`), enregistrés comme `"queue": "database"` |

Frictions rencontrées en chemin :

- `generate background-job ... --command CancelAppointment` refuse la commande : son
  constructeur a besoin d'`appointmentId`, qu'un *job* généré ne peut pas connaître. Juste pour
  un *job* généré, qui envoie une commande depuis son acteur ; le vidage envoie une commande
  par élément de son *payload*, une boucle avec un point de reprise qu'aucun *template* ne
  devine. Écrit à la main, 70 lignes.
- `generate query GetClearance` a écrit un port de lecteur, son adaptateur en mémoire et son
  *fake* : la réponse vient de `JobQueue.find`, un port du noyau, donc les trois fichiers ont été
  supprimés.
- Dans une *spec*, une commande exécutée avec un acteur qui n'est pas celui de la portée
  d'exécution met son *job* en file d'attente en tant qu'acteur de la portée (`test-user`), pas
  en tant qu'acteur de la commande : le *job* se voyait alors refuser `appointment.cancel`.
  `application.as(holder, ...)` dans la *spec*, comme le fait la bordure HTTP, l'a corrigé ; la
  *spec* qu'écrit `generate background-job` met en file d'attente de la même façon.
- La première liste de statuts de la réponse de `GetClearance` écrivait `'cancelled'` comme un
  littéral : `language/declared-vocabulary` l'a signalé comme une valeur d'`AppointmentStatus`.
  Depuis la revue ci-dessous, le kit publie `QueuedJobStatus` comme vocabulaire et le contrat a
  une énumération.

Prouvé : 16 tests unitaires pour le vidage (la commande, le *job* interrompu à mi-chemin et
repris, un rendez-vous annulé entre-temps, la requête, les deux contrôleurs), et un parcours de
bout en bout de deux tests sur l'application avec son *worker* en marche, sur PostgreSQL dans le
processus : l'absence est refusée, le vidage annule les deux rendez-vous et dit
`{ done: 2, total: 2 }`, puis l'absence est acceptée. La suite unitaire (1 340 tests) et ses
planchers de couverture passent.

### 2026-10-13, après revue : un vidage appartient à son calendrier

Une revue du lot a trouvé que la requête d'un vidage se fiait au secret de son identifiant,
que son statut était publié en texte libre, et que la file d'attente ne voyait pas les
*tenants*. Ce qui a changé ici :

| | |
|---|---|
| Appartenance | `ClearCalendar` met son *job* en file d'attente avec le calendrier comme `subject` ; `GetClearance` répond `UNKNOWN_CLEARANCE` (404) pour un *job* dont le sujet est un autre calendrier, et la file d'attente cache à `find` les *jobs* d'un autre *tenant* |
| Contrat | `GET /calendars/{calendarId}/clearances/{clearanceId}` : `status` est désormais une énumération (`waiting`, `running`, `succeeded`, `cancelled`, `dead`) à travers `@IsIn(Object.values(QueuedJobStatus))` ; le client typé la restreint de la même façon. Aucune route n'a été ajoutée ni retirée |
| Prouvé | un cas unitaire (le vidage d'un autre calendrier est inconnu) et un cas de bout en bout (le praticien d'un autre cabinet reçoit un 404 pour le vidage de celui-ci) |
| Manque connu | le vidage fige sa liste au moment où il est demandé et ne réserve pas la période : un rendez-vous réservé avant l'ajout de l'absence n'est ni annulé ni bloqué, et l'absence est de nouveau refusée ; une requête HTTP rejouée lance un second vidage. Écrit dans le gestionnaire, laissé tel quel |

`generate background-job` porte désormais les entrées d'une commande dans le *payload* (un `Date`
sous la forme de son texte ISO) : `--command CancelAppointment` générerait aujourd'hui, mais le
vidage envoie toujours une commande par rendez-vous de son *payload*, avec un point de
reprise entre deux, ce qu'aucun *template* ne devine.
