[English](coding-agents.md) · **Français**
<!-- translation-of: coding-agents.md sha256:12b8a3b231d6d0ac -->

# Le plugin pour agents de code : Claude Code, Codex, GitHub Copilot

Le [dépôt ddd-ts-kit](https://github.com/gbourgeat/ddd-ts-kit) est la marketplace du plugin pour
les trois agents :

| Agent | Installation | Une skill s'appelle |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, puis `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, puis installer `ddd-ts-kit` depuis `/plugins` et approuver ses hooks dans `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, puis `copilot plugin install ddd-ts-kit@ddd-ts-kit` | par son nom, `start` |
| Agent cloud de Copilot, VS Code | déclaré par le `.github/copilot/settings.json` qu'écrit `init` : l'agent cloud l'installe, VS Code le recommande | par son nom, `start` |

Vingt-trois skills, dans l'ordre où un projet les rencontre :

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
| `story` | mener une *user story* de ses questions à une *pull request* verte en une session, une *story* par terminal (lancée par l'utilisateur ; [parcours d'une story](story-workflow.fr.md)) |
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

Cinq agents : `domain-explorer` (réponses en lecture seule sur ce qui existe et où),
`context-builder` (construit les tranches d'un contexte dans son propre worktree),
`domain-test-writer` (transforme les entrées `it.todo` en specs), `architecture-reviewer`
(revue en lecture seule d'un diff, d'une branche ou d'un contexte) et `acceptance-judge` (juge un
changement d'un test d'acceptation verrouillé, indépendamment de la session qui l'a fait, et écrit
son verdict).

Le hook est la partie qui rend le reste contraignant. Dans un projet qui a un
`ddd-ts-kit.config.json`, il rappelle la démarche et la carte des contextes au début de la
session, signale quand les packages installés ne sont pas la version que décrivent les skills, refuse un fichier écrit à la main là où un générateur existe ainsi que toute
modification d'un contrat généré, demande l'avis du propriétaire du projet avant qu'une
désactivation, un test sauté ou un changement des règles soit écrit, vérifie chaque fichier
écrit et renvoie les violations avec leur correction, et refuse de terminer tant que des
erreurs d'architecture restent. Il rappelle, sans bloquer, quand les changements non commités
dépassent la taille conseillée d'un commit, et dans le worktree d'un worker
(`.ddd-ts-kit/worker.json`), il refuse une écriture hors du contexte du worker, par les outils
d'édition ou par le *shell* (`sed -i`, une redirection, `tee`, `cp`, `mv`, `rm`), arrête le
worker quand son code en ligne (`node -e`, un *heredoc*) a changé un fichier hors de ce contexte,
et refuse un changement de dépendance et un autre formateur que `npm run format`.
Pour un `context-builder`, il compte les appels d'outils dans ces mêmes *hooks* et avertit
l'agent deux fois avant sa limite de tours, enregistre ses exécutions dans son *worktree*
(`.ddd-ts-kit/agent.json`), et écoute deux événements rares de Claude Code, filtrés sur cet agent :
`SubagentStart` (un lancement ou une reprise démarre un nouveau compte) et `SubagentStop` (quand il
finit de lui-même, il est relancé une fois pour commiter une tranche que `verify-slice` a validée
ou réécrire un rapport périmé). Au démarrage de session, il nomme les *workers* à reprendre
([travail en parallèle](parallel-work.fr.md#quand-un-agent-sarrête)). Dans un projet créé par
`init` (`"worktrees": "required"`), il refuse le code d'un contexte et les générateurs qui
l'écrivent dans le *checkout* principal du tronc, et dans un *worktree* de `.worktrees/` sans son
propre `node_modules` : `npx ddd-ts-kit worktree <name>` ouvre l'endroit où l'écrire ; un projet
démarré avant en est seulement averti au démarrage de session. Dans le *worktree* d'une
*story* (`.ddd-ts-kit/story.json`), il refuse tout code d'un contexte tant que chaque ligne n'a
pas sa revue de conception et que l'acceptation n'est pas écrite et verrouillée, dit la phase de
la *story* au démarrage de session avec ses croisements avec les autres *stories* ouvertes, dit
une fois par fichier quand la session écrit un fichier qu'une autre *story* ouverte change, et
refuse une fois de finir la session avant son rapport
([parcours d'une story](story-workflow.fr.md)). Aucun *hook* ne tourne sur
chaque appel d'outil : une session ordinaire ne lance pas plus de processus qu'avant. En cas de
panne, il laisse passer : une garde cassée ne bloque jamais le travail, ce qui en fait un guide, pas une frontière de sécurité : pour isoler un agent, voir [Isoler les agents de code](agent-sandbox.fr.md). Mettez `"guard": "advise"` dans la
configuration pour être consulté au lieu d'essuyer un refus, `"off"` pour le faire taire.

Chaque agent reçoit ce que son hôte exécute. Les skills fonctionnent dans les trois. Les cinq
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

## Ce qui tient chaque skill

Une *skill* est un conseil : elle dit à un agent quoi lancer et quoi décider, et un agent peut
l'ignorer. Le [playbook du cycle de vie AI-native d'Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)
dit ce qu'une équipe soumise à une réglementation demande avant d'accepter la moindre *skill* :
une politique qui doit toujours tenir a besoin de quelque chose de déterministe derrière elle, un
*hook* qui bloque l'action ou un contrôle qui l'attrape ensuite. Cette table nomme ce contrôle
pour chaque *skill* du plugin : les identifiants de règle de `ddd-ts-kit rules` (tenus par le
checker, le plugin ESLint ou dependency-cruiser, voir
[qui vérifie quoi](../ARCHITECTURE.fr.md#qui-vérifie-quoi)), les gardes du *hook*, et les
contrôles du *pipeline*. Un test du plugin (`node --test plugin/skills/controls.test.mjs`) échoue
quand un identifiant de règle nommé ici est inconnu de la CLI, ou quand une *skill* n'a pas de
ligne.

| Skill | Contrôle déterministe derrière elle | Manque |
|---|---|---|
| `start` | `ddd-ts-kit status` lit `docs/architecture/plan.md` et `slices.md` et nomme la prochaine étape ; la garde rappelle la démarche au démarrage de session | la forme de `plan.md` est lue, pas vérifiée |
| `discover-domain` | aucun en propre : `docs/architecture/discovery.md` est lu par les étapes suivantes, pas vérifié | la vérité stratégique ne se vérifie pas, comme le dit la [méthodologie](methodology.fr.md) |
| `bounded-contexts` | `context/no-cycle`, `context/extractable`, `tree/context-doc` (chaque contexte a son `CONTEXT.md`), `docs --check` | la classification d'un contexte est lue, pas jugée |
| `glossary` | le générateur refuse un nom que le glossaire ne tient pas ; `language/glossary-term`, `language/declared-vocabulary`, `language/no-technical-name` | |
| `context-map` | `context/no-cycle`, `context/declared-relationship`, `context/published-language-only`, `context/published-language-is-a-contract`, la carte des contextes régénérée et comparée par `docs --check` | |
| `bootstrap` | `init` écrit un projet vert sous `npm run verify` ; `config/valid` ; `doctor --strict` | |
| `plan-slices` | `status`, `story-check` et `worker-scope --rows` lisent les lignes de `slices.md` et refusent une ligne inconnue ; `verify-slice` | l'ordre des lignes est conseillé (`plan-waves`), jamais refusé |
| `parallel-work` | la garde du *worker* (`.ddd-ts-kit/worker.json` : une écriture hors du contexte est refusée, par les outils d'édition et par le *shell*), `verify-merge`, `merge-trunk`, `status --workers` | |
| `story` | `story --gate build` et `--gate close`, la garde dans le *worktree* d'une *story* (pas de code avant la revue de conception et le verrou), `acceptance --lock`, `test/acceptance-black-box`, l'agent `acceptance-judge` | le code n'est pas comparé à sa revue de conception après la construction |
| `scaffold` | la garde refuse un fichier de rôle écrit à la main ; `tree/closed`, `tree/documented-paths`, `naming/suffix`, `naming/one-concept-per-file`, `naming/business-name`, `naming/search-not-list`, `test/spec-required`, `test/builder-required`, `lifecycle/status-through-machine`, `process/sends-commands-only`, `scheduling/job-name`, `scheduling/job-triggers-use-case` | |
| `use-case` | les contrôles de `scaffold`, puis `application/handler-shape`, `application/command-query-separation`, `domain/aggregate-encapsulation`, `domain/value-object-class`, `domain/value-object-immutability`, `domain/no-generic-error`, `domain-events/dispatched-on-save`, `domain-events/transactional-before-commit`, `errors/code-listed`, `errors/code-unique`, `errors/through-factory`, `presentation/controller-shape`, `presentation/controller-delegates`, `schema/presentation-only`, `schema/no-duplicate-shape`, les tests du contexte lancés par `verify-slice` | |
| `integration-event` | `events/defined-in-published-language`, `events/name-declared-once`, `events/name-format`, `events/outbox-required`, `events/consumer-idempotent`, `event-sourcing/upcaster-required` (le verrou des événements stockés), le catalogue d'événements et le document AsyncAPI comparés par `docs --check` | |
| `wiring` | `ports/abstract-class`, `ports/no-token-constant`, `ports/no-concrete-dependency`, `ports/implements-never-extends`, `ports/value-import`, `declarations/role-declared`, `declarations/constructor-injection`, `declarations/barrel-current`, `declarations/port-adapter-wired`, `composition/only-in-module`, le *barrel* régénéré par `docs` | |
| `persistence` | `layer/domain-purity`, `layer/application-inward`, `files/port-not-connector`, `persistence/migration-history`, `persistence/primary-key-order`, `persistence/no-file-content`, `tenancy/scoped-statement`, les suites de contrat, le seuil de couverture de `infrastructure/` (`test/coverage-governed`) | un adaptateur sans sa suite de contrat n'est signalé par `test/spec-required` que quand son fichier de spec manque |
| `access-control` | `authz/declared`, `authz/granted`, `authz/in-application`, `authz/actor-explicit`, `authz/policy-asked`, `authz/scope-narrows`, `authz/fields-by-schema`, `presentation/guard-at-the-edge` | |
| `cross-cutting` | `aspects/outside-in`, `tracing/platform-only`, `standard/no-parallel-interface`, `purity/no-system-clock`, `purity/no-ambient-randomness`, `purity/no-environment`, `presentation/shared-cache-varies` | |
| `testing` | `test/no-mocks`, `test/spec-required`, `test/builder-required`, `test/helper-placed`, `test/coverage-governed`, `test/acceptance-black-box`, le verrou de l'acceptation | la spec de régression d'un correctif n'est pas verrouillée : seuls les scénarios d'acceptation d'une *story* le sont |
| `clean-code` | `clean/stepdown`, `clean/function-size`, `clean/file-size`, `clean/blank-lines`, `clean/braces`, `clean/one-export-per-file`, `clean/no-escape-hatch`, `clean/no-commented-out-code`, `clean/no-noise-comment`, `clean/no-flag-argument`, `clean/no-hash-private`, `clean/no-magic-number`, `clean/formatted` (Biome dans le *hook* de *commit* et dans le *pipeline*), `language/no-technical-name` | le formateur tourne au *commit* et en CI, pas à l'écriture |
| `document` | `docs --check` (`npm run docs:check`, la porte `docs` du *pipeline*), `declarations/barrel-current`, `tree/context-doc`, `sdk --check` | |
| `extract-service` | `context/extractable`, `context/published-language-only`, `imports/alias-only`, le point d'entrée par contexte qu'écrit `generate service` et son test de démarrage | |
| `deviation` | `governance/recorded-deviation`, `config/suppression-needs-reason`, `config/rule-off-everywhere`, la garde demande l'avis du propriétaire avant une désactivation, un test sauté ou un changement des règles | |
| `quality-gate` | `npm run verify`, le *hook* `Stop` de la garde (il refuse de terminer tant que des erreurs d'architecture restent), le *job* `gate` du *pipeline* | |
| `commit-discipline` | `check --commit-size` (un conseil), commitlint dans le *hook* `commit-msg` et le contrôle du titre du *pipeline* | la taille est conseillée, jamais refusée : un choix du kit, conservé |

Deux manques n'appartiennent à aucune *skill* : un secret dans un *diff* n'est attrapé que par
gitleaks dans le *pipeline*, et la mise en page d'un fichier est réglée au *commit*, pas à
l'écriture.

## Évaluer vos propres skills

Un projet qui écrit ses propres *skills* (une politique de l'organisation, une convention d'une
équipe) peut les tenir au même test : un répertoire `evals/` à côté d'elles, lancé par
`claude plugin eval`, un cas par promesse, avec les vraies tâches du projet comme *prompts* et
des évaluateurs qui lisent le résultat. Le kit ne génère rien pour cela : la suite du playbook se
construit à partir des tâches du projet, qu'aucun *template* ne connaît. La suite du plugin
lui-même, sous `plugin/evals/` du dépôt, est un exemple travaillé, et
[CONTRIBUTING.fr.md](../../CONTRIBUTING.fr.md#la-suite-dévaluation-du-plugin) dit comment un cas
s'écrit, quand on en ajoute un et ce qu'il coûte.
