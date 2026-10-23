[English](coding-agents.md) · **Français**
<!-- translation-of: coding-agents.md sha256:ccccdf927d42c122 -->

# Le plugin pour agents de code : Claude Code, Codex, GitHub Copilot

Le [dépôt ddd-ts-kit](https://github.com/gbourgeat/ddd-ts-kit) est la marketplace du plugin pour
les trois agents :

| Agent | Installation | Une skill s'appelle |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, puis `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, puis installer `ddd-ts-kit` depuis `/plugins` et approuver ses hooks dans `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, puis `copilot plugin install ddd-ts-kit@ddd-ts-kit` | par son nom, `start` |
| Agent cloud de Copilot, VS Code | déclaré par le `.github/copilot/settings.json` qu'écrit `init` : l'agent cloud l'installe, VS Code le recommande | par son nom, `start` |

Vingt-cinq skills, dans l'ordre où un projet les rencontre :

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
| `intent` | saisir une idée comme une intention avant toute *story*, dans les mots de celui qui l'a, pour que le responsable du produit l'accepte dans une *pull request* (lancée par l'utilisateur ; [parcours d'une story](story-workflow.fr.md#doù-vient-une-story)) |
| `story` | mener une *user story* de ses questions à une *pull request* verte en une session, une *story* par terminal (lancée par l'utilisateur ; [parcours d'une story](story-workflow.fr.md)) |
| `pull-request` | mener la *pull request* d'une *story* au vert : balayer ses commentaires de revue et ses vérifications en échec sous les règles de la *story*, pousser, attendre, recommencer ; puis rendre compte de ce qui a changé et de ce qui a été refusé (lancée par l'utilisateur) |
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

Six agents : `domain-explorer` (réponses en lecture seule sur ce qui existe et où),
`context-builder` (construit les tranches d'un contexte dans son propre worktree),
`domain-test-writer` (transforme les entrées `it.todo` en specs), `architecture-reviewer`
(revue en lecture seule d'un diff, d'une branche ou d'un contexte), `acceptance-judge` (juge un
changement d'un test d'acceptation verrouillé, indépendamment de la session qui l'a fait, et écrit
son verdict) et `story-verifier` (vérification en lecture seule d'une *story* à sa clôture, dans
un contexte neuf : il démarre l'application comme le font les tests de bout en bout, exerce les
routes de la *story* et les deux flux les plus proches, et rend compte de ce qui ne correspond pas
à la conception ou à une décision).

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

Chaque agent reçoit ce que son hôte exécute. Les skills fonctionnent dans les trois. Les six
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
