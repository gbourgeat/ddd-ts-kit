[English](coding-agents.md) · **Français**
<!-- translation-of: coding-agents.md sha256:96e951c26efb9cbe -->

# Le plugin pour agents de code : Claude Code, Codex, GitHub Copilot

Le [dépôt ddd-ts-kit](https://github.com/gbourgeat/ddd-ts-kit) est la marketplace du plugin pour
trois agents de code :

| Agent | Installation | Une skill s'appelle |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, puis `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, puis installer `ddd-ts-kit` depuis `/plugins` et approuver ses hooks dans `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, puis `copilot plugin install ddd-ts-kit@ddd-ts-kit` | par son nom, `start` |
| Agent cloud de Copilot, VS Code | déclaré par le `.github/copilot/settings.json` qu'écrit `init` : l'agent cloud l'installe, VS Code le recommande | par son nom, `start` |

Vingt-six skills, dans l'ordre où un projet les rencontre :

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
| `fix` | réparer un défaut dans son propre *worktree*, sa *spec* de régression écrite et verrouillée avant tout code (lancée par l'utilisateur ; [un correctif](story-workflow.fr.md#un-correctif--la-spec-de-régression-dabord-verrouillée)) |
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
(revue en lecture seule d'un diff, d'une branche ou d'un contexte, sous le `REVIEW.md` du projet
quand il en a un : les passes de l'équipe par-dessus la méthode de l'agent, chaque constat
étiqueté de sa passe), `acceptance-judge` (juge un
changement d'un test d'acceptation verrouillé, indépendamment de la session qui l'a fait, et écrit
son verdict) et `story-verifier` (vérification en lecture seule d'une *story* à sa clôture, dans
un contexte neuf : il démarre l'application comme le font les tests de bout en bout, exerce les
routes de la *story* et les deux flux les plus proches, et rend compte de ce qui ne correspond pas
à la conception ou à une décision).

La description de chaque skill dit quand s'en servir en 320 caractères au plus, et les
vingt-six en prennent 6 500 au plus ensemble ; celle d'un agent, 400 au plus. Claude Code charge
la liste des skills dans chaque session dans la limite de 1 % de la fenêtre de contexte, environ
2 000 tokens sur une fenêtre de 200k, et au-delà retire les descriptions des skills les moins
invoquées, qui ne se déclenchent alors plus sur leurs mots-clés. La liste porte aussi
`ddd-ts-kit:<nom>` pour chaque entrée (environ 660 caractères pour les vingt-six), et ce texte
technique compte environ 3,5 caractères par token : (6 500 + 660) / 3,5 font environ 2 050
tokens si les vingt-six étaient listées, mais `bootstrap`, `fix`, `intent`, `pull-request`,
`start` et `story`, lancées par l'utilisateur seul (`disable-model-invocation`), ne le sont pas, ce qui laisse les vingt autres à environ 1 600
tokens. Un test du plugin (`node --test plugin/skills/descriptions.test.mjs`) tient ces limites.

Le corps d'une skill est lu en entier dès qu'elle se charge : ce qu'une seule option de `stack`
demande est donc rangé à côté. Le corps garde chaque règle et une ligne, « sous
`stack.<clé>: <valeur>`, lire d'abord `<fichier>.md` », et le fichier, lu sur cette stack
seulement, s'ouvre sur le moment où on le lit et renvoie à la page de `docs/` qu'il paraphrase
(sous `concepts/`, `tools/` ou `guides/`). `wiring` garde le style déclaré et lit `explicit.md`,
`nest.md` et `earlier-layouts.md` ; `access-control` lit `relationships.md` sous `rebac` ;
`persistence` lit `tenancy.md`, `event-sourcing.md`, `personal-data.md` et `migrations.md` ;
`use-case` lit `factories.md`, `function-routes.md` et `file-upload.md`. Un test du plugin
(`node --test plugin/skills/bodies.test.mjs`) tient ces quatre corps sous un plafond de mots,
comptés comme `wc -w` les compte : `wiring` 1 200, `access-control` 1 900, `persistence` 1 200,
`use-case` 2 200.

Le hook est la partie qui rend le reste contraignant. Dans un projet qui a un
`ddd-ts-kit.config.json`, il rappelle la démarche et la carte des contextes au début de la
session, signale quand les packages installés ne sont pas la version que décrivent les skills, refuse un fichier écrit à la main là où un générateur existe, toute
modification d'un contrat généré et l'écriture de la *baseline* des erreurs (`check --baseline
write`, quelle que soit la façon de lancer le kit, script de paquet compris, ou une modification
de `ddd-ts-kit-baseline.json` : le propriétaire du projet l'écrit,
dans un terminal), refuse une commande git qui saute les hooks du projet (`--no-verify`, `-n` sur un
commit, `-c` ou `--config-env` de `core.hooksPath` ou son réglage dans l'environnement,
`LEFTHOOK=0`, `HUSKY=0`, `LEFTHOOK_EXCLUDE`, `git commit-tree` : les hooks sont la barrière locale du
pipeline ; les mots d'une commande sont lus tels que le *shell* les donne, guillemets ôtés) et, à un sous-agent, un `git config` qui fixe une valeur ou un `git -c` d'une clé qui
lance une commande dans chaque *checkout* (`core.fsmonitor`, `core.pager`, `core.editor`,
`core.sshCommand`, un `alias.*`, un pilote *diff*, *merge* ou *filter*, `diff.external`, un
`include.path`, un assistant d'identifiants, un *pager*, un outil de `mergetool` ou `difftool`, un
programme `gpg`, un `protocol.*`), donnée par `-c` ou `--config-env`, ou une variable
d'environnement qui confie à git un programme ou des réglages (`GIT_EXTERNAL_DIFF`, `GIT_PAGER`,
`GIT_EDITOR`, `GIT_SSH_COMMAND`, `GIT_CONFIG_*`...), demande l'avis du propriétaire du projet avant qu'une
désactivation, un test sauté ou un changement des règles soit écrit par les outils d'édition, vérifie chaque fichier
écrit et renvoie les violations avec leur correction (les cinq premiers d'un *patch* de Codex,
les autres nommés comme non vérifiés ; avec `"dependenciesBeforeWrite": true`, à
l'essai, il refuse avant l'écriture un nouvel import qui enfreint une règle de dépendance), et
refuse de terminer tant que des
erreurs d'architecture restent dans un arbre aux changements non *committés* (un arbre propre est
laissé au *hook* de pre-commit et au *pipeline* ; une vérification qui ne finit pas à temps, ou qui répond plus que
les 64 Mio que la garde lit, laisse la session terminer et le dit ; un début de session qui passe dix secondes d'appels à la CLI saute ceux qui
restent et dit qu'il a été écourté). Avec `"formatOnWrite": true` dans la configuration (écrite par `init` pour un nouveau projet), il lance
d'abord le Biome que le projet a installé sur le fichier écrit (le *bin* de son paquet
`@biomejs/biome`, `format --write`, un fichier, jamais un autre formateur), pour que la mise en page soit réglée à
l'écriture et que les constats du lint qui suivent une ligne repliée reviennent dans la même
sortie ; une exécution qui échoue ne change rien. Il rappelle, sans bloquer, quand les changements non commités
dépassent la taille conseillée d'un commit, et dans le worktree d'un worker
(`.ddd-ts-kit/worker.json`), il refuse une écriture hors du contexte du worker, par les outils
d'édition ou par le *shell*. Les outils d'édition d'un *builder* sont tenus où que soit le fichier,
dès son premier appel : un chemin qui a oublié son *worktree* est refusé dans le *checkout* du chef
d'orchestre, dans un autre *worktree* et hors de tout projet sauf le répertoire temporaire, avec la
consigne de nommer le fichier sous son *worktree*. Il lit toute la ligne de commande, chacune de ses commandes, pas
seulement celle qui commence par `cd <worktree> &&` : un worker lance chaque commande ainsi, et
celle qui écrit sans entrer dans son worktree est refusée avec cette consigne : depuis un autre
*checkout*, un worker ne fait que lire (`cat`, `ls`, `grep`, git qui lit, `git add` et `git commit`
dans son propre *worktree*, le kit interrogé pour lister, décrire, rendre compte ou lire un
*briefing*), quel que soit le programme. Une session ouverte au-dessus du projet tient son worker au
projet que nomme sa commande, et un worker qui se tient dans son *worktree* y reste épinglé quand une
commande commence dans un autre projet. Il ne suit un `cd`
que lorsqu'il est certain (après `&&`, vers un répertoire qui existe), de sorte qu'une écriture
après `cd dir;` ou un `cd` qui échoue est refusée plutôt que mal placée ; il lit un nom que le
*shell* calcule (une variable, une substitution, une liste d'accolades), un lanceur (`nice`,
`ionice`, `setsid`, `flock`, `busybox`, `su -c`, `env -S`), un exécuteur de paquet (`npx`,
`npm exec`) et la commande qu'il lance ; et il connaît les écritures que les tables de fichiers
manquent (`>&`, un script `sed` ou `awk` qui écrit, `vim`/`ed`, `rsync`, `curl -o`, `wget -O`,
`tar -x`, `git stash`/`reset --hard`/`worktree add`/`checkout -f`, `eslint --fix`, `biome
--write`). Les seuls endroits libres d'un worker hors de son périmètre sont `/dev/null`, les
périphériques standard et le répertoire temporaire (`$TMPDIR`) hors de tout projet (un projet cloné là garde ses règles) ; tout autre chemin absolu est
refusé. Un fichier est jugé là où il aboutit : un lien du périmètre, ou un dossier de son chemin qui en
est un, est l'endroit qu'il atteint, un lien du répertoire temporaire vers un projet est cet
endroit, et un fichier du périmètre qui porte un autre nom ailleurs (un lien physique) est refusé. Une commande imbriquée plus profond que le lecteur ne suit (plus de cinq *shells* ou
`eval`) est refusée plutôt que laissée passer sans lecture ; de même, à un *worker*, une ligne qui
finit dans une citation ou sur un *here-document* jamais fermé, et une commande sur laquelle le
lecteur échoue. Le code qu'il ne peut pas lire (du code
en ligne comme `node -e`, un script, un *shell* nourri par son entrée, `make`, un script ou un
exécuteur de paquet comme `npm test` ou `npx`) s'exécute, mais avant chaque commande d'un *worker*
qui en lance (toute commande sauf les pures lectures : `cat`, `ls`, `grep`, `git log`,
`git status`... nommées par leur nom, git sans réglage donné à la commande ni option qui confie
les fichiers à un programme comme `grep -O` ou `--ext-diff` ; le kit compte comme le programme, ou
comme premier opérande de `node` ou d'un exécuteur de paquet), la garde note l'état hors du périmètre (le `git status` et le `HEAD` du
*worktree*, du *checkout* de la session quand c'en est un autre, et le manifeste et le *bin* de la
CLI du kit et de Biome dans `node_modules`), et le compare à l'appel suivant du *worker*. Une lecture
laisse en place la note du *worktree*, pour ce que la commande a laissé tourner en arrière-plan,
jusqu'à un changement ou une nouvelle note. L'arrêt du *worker* la compare une dernière fois : le
*worker* continue une fois pour remettre un fichier en état, et ce qui reste est dit au chef
d'orchestre dans `lastStop.outside` de `agent.json`, dans son rapport, dans `status --workers` et
dans `worker-scope --resume`. Un `git status` qui ne répond pas en entier ne compare rien, et la
garde le dit. Un fichier
du *worktree* changé hors du périmètre, supprimé ou commité compris, arrête le *worker* jusqu'à ce
qu'il soit remis en état par la commande que la garde nomme : son contenu commité (`git checkout
<commit> -- <path>`, puis `git commit` quand un commit l'a changé), le contenu qu'il avait avant la
commande quand il était déjà modifié (gardé sous `.ddd-ts-kit/guard/held/`), `git mv` en retour
pour un renommage, `rm` pour un nouveau fichier. Un fichier laissé modifié dans l'arbre de travail
du *checkout* de la session (pas celui que le chef d'orchestre commite ou fusionne entre-temps) ou
un changement de ces paquets est dit une fois, pour le chef d'orchestre, qui seul sait s'il l'a fait.
Ce que les scripts du projet lui-même (`npm run format`, `lint:fix`, `regenerate`, `docs:generate`,
`openapi:generate`, `events:generate`), seuls sur la ligne, réécrivent hors du périmètre parmi les
fichiers que leurs outils réécrivent (code, JSON, `docs/`) est dit avec le script qui l'a réécrit,
sans retenir le *worker* : il le laisse hors de ses commits. Le
périmètre est fixé au premier appel du *worker* : un fichier de périmètre supprimé ou changé
l'arrête jusqu'à ce que le chef d'orchestre le rétablisse, et le mode de la garde est fixé avec lui :
une config du *worktree* qui éteint la garde, ou qui dépasse ce que la garde lit, ne libère pas un
*worker*, son changement étant comparé comme tout autre. Une branche que le *worker* fusionne dans la
sienne est son travail : seul ce que le tronc contient est au tronc. Le `merge-trunk` du kit n'est pas noté,
et une installation du *lockfile* laisse les paquets hors de la note. Il refuse un changement de
dépendance et un autre formateur que `npm run format`. L'`architecture-reviewer`, le
`domain-explorer` et le `story-verifier` ne changent aucun fichier d'un projet par le *shell*, ni
son arbre de travail par git (ils lisent avec `git show` et `git diff`). Un sous-agent ne peut ni supprimer, ni
déplacer, ni réinitialiser une branche extraite dans un autre *worktree* (celle d'un autre
*worker*, ou le tronc), options courtes groupées ou longues abrégées comprises. Le git d'un *worker*
ne change que son propre *worktree* : depuis tout autre *checkout* il lit (`status`, `log`, `diff`,
`worktree list`, `fetch`...), de sorte que seul le chef d'orchestre pose une branche ou déplace son
*checkout*, et qu'aucun *worker* ne retire un *worktree* ni n'écrit une référence (`worktree remove`,
`update-ref`). La même lecture
du *shell* tient le `domain-test-writer` aux chemins d'un test (une *spec*, le `test/` de la racine
ou les dossiers de test d'un contexte, et un fichier qu'il nomme : un endroit que seul le *shell*
connaît lui est refusé), le code d'une *story* à sa barrière
de construction, et toute écriture à la main d'un fichier généré ou de la *baseline* par n'importe
quelle session, chacune par les endroits qu'une commande écrit plutôt que par son texte, dans le
projet qui possède l'endroit, quel que soit le *checkout* où se tient la session. Ce qu'une
redirection, `sed -i` ou `tee` tape dans un fichier est tenu comme par les outils d'édition : le code
d'un contexte dans le *checkout* principal du tronc, un nouveau fichier d'un rôle généré. Un fichier
généré remis en état ou supprimé (`git checkout`, `git restore`, `git rm`, `rm`) reste libre, puisqu'il
est reconstruit ensuite ; de même ce qu'une session autre qu'un *worker* ou le `domain-test-writer`
écrit là où seul le *shell* sait. Un
`apply_patch` de Codex envoyé par le *shell* est lu comme un *patch*, chaque *patch* de la ligne,
dans un *here-document* ou un argument ; celui que la commande ne contient pas (un fichier, un
*pipe*) est refusé. Un fichier qu'un *patch* supprime, ou quitte par un déplacement, est tenu comme
`rm` le tient (la *baseline*, le périmètre d'un *worker*).
Pour un `context-builder` (l'agent du *plugin*, `ddd-ts-kit:context-builder` : un agent du projet
nommé `context-builder` sans ce préfixe est tenu à la portée de son *worktree*, mais ni compté ni
enregistré), il compte les appels d'outils dans ces mêmes *hooks* et avertit
l'agent deux fois avant sa limite de tours, enregistre ses exécutions dans son *worktree*
(`.ddd-ts-kit/agent.json`), et écoute deux événements rares de Claude Code, filtrés sur cet agent :
`SubagentStart` (un lancement ou une reprise démarre un nouveau compte) et `SubagentStop` (quand il
finit de lui-même, il est relancé une fois pour commiter une tranche que `verify-slice` a validée,
réécrire un rapport périmé ou remettre en état ce que sa dernière commande a changé hors de son
périmètre). Au démarrage de session, il nomme les *workers* à reprendre
([travail en parallèle](parallel-work.fr.md#quand-un-agent-sarrête)). Dans un projet créé par
`init` (`"worktrees": "required"`), il refuse le code d'un contexte et les générateurs qui
l'écrivent dans le *checkout* principal du tronc, et dans un *worktree* de `.worktrees/` sans son
propre `node_modules` : `npx ddd-ts-kit worktree <name>` ouvre l'endroit où l'écrire ; un projet
démarré avant en est seulement averti au démarrage de session. Dans le *worktree* d'une
*story* (`.ddd-ts-kit/story.json`, que la session qui s'y tient et tout sous-agent ne changent
d'aucune façon, pas plus que `.ddd-ts-kit/worker.json` dans le *worktree* d'un *worker*), il refuse tout code d'un contexte tant que chaque ligne n'a
pas sa revue de conception et que l'acceptation n'est pas écrite et verrouillée, dit la phase de
la *story* au démarrage de session avec ses croisements avec les autres *stories* ouvertes, dit
une fois par fichier quand la session écrit un fichier qu'une autre *story* ouverte change, et
refuse une fois de finir la session avant son rapport
([parcours d'une story](story-workflow.fr.md)). Dans le *worktree* d'un correctif
(`"kind": "fix"` dans ce fichier), il ouvre le code dès que la *spec* de régression est
verrouillée, et refuse toute modification d'une *spec* verrouillée, par les outils d'édition
comme par le *shell*, à ses sous-agents : un dossier qui contient la *spec* compte comme la *spec*,
de même qu'une écriture dont seul le *shell* connaît l'endroit (`xargs sed -i`, `cd dir; sed -i`),
tandis qu'un `find -exec` est jugé sur les dossiers d'où il part, et que les lectures par l'un ou
l'autre restent libres. La session elle-même peut en écrire une nouvelle version,
que `acceptance` signale et sur laquelle l'agent `acceptance-judge` se prononce. Une commande qui
écrit le verrou d'une acceptation ou un verdict (jugée par les endroits qu'elle écrit, un *glob*
étendu, et non par son texte ; un dossier qui les contient, `test/acceptance` ou `test`, compte
comme eux, et de même un endroit que seul le *shell* connaît sur une ligne qui nomme l'acceptation)
est refusée : une commande peut changer de répertoire ou tester un chemin (`cd`, `pushd`, `popd`,
`pwd`, `test`), lire le fichier (`cat`, `grep`, `rg` sans `--pre`, `sed` sans `-i`, `awk`, `less`,
`jq`), le versionner (`git add`, `commit` sans `-a`, `log`, `show`, `status`, aucun avec
`--output`) ou lancer le kit (`ddd-ts-kit`, `npx ddd-ts-kit`) ; tout autre programme (un `npx` ou
`pnpm` nu, `git checkout`/`stash`), ou une redirection vers un fichier, est une écriture, que seuls
la CLI et cet agent font. Le juge lui-même lit git sans ajouter ni *committer*, et ne lance le kit
que pour lire (`acceptance` sans `--lock`, `list`, `describe`, `explain`, `status`, `story`,
`stories`, `story-check`). Aucun *hook* ne tourne sur
chaque appel d'outil : une session ordinaire ne lance pas plus de processus qu'avant. En cas de
panne, il laisse passer : une garde cassée ne bloque jamais le travail, ce qui en fait un guide, pas une frontière de sécurité : il lance la CLI `ddd-ts-kit` et le Biome du projet lui-même depuis `node_modules` (le *bin* que nomme chaque paquet, avec Node, jamais un paquet installé au-dessus du sommet du dépôt, ni une config ou une CLI dans un dossier qu'un autre utilisateur peut écrire, le répertoire temporaire partagé avant tout), et de ce qu'écrit un code qu'il ne peut pas lire, il ne compare que ce qui est noté plus haut : les autres fichiers ignorés par git et les endroits hors de ces *checkouts* ne sont pas énumérés, et l'état qu'il garde entre deux appels se trouve dans le projet, à portée d'un code qui vise la garde ; pour isoler un agent, voir [Isoler les agents de code](agent-sandbox.fr.md). Mettez `"guard": "advise"` dans la
configuration pour être consulté au lieu d'essuyer un refus, `"off"` pour le faire taire.

Chaque agent reçoit ce que son hôte exécute. Les skills fonctionnent dans les trois. Les six
agents sont des sous-agents de Claude Code ; Codex ne charge aucun agent depuis un plugin, et une
session par worktree tient le rôle de `context-builder`. Le hook tourne partout où l'hôte exécute
les hooks d'un plugin : il lit les patchs de Codex et les appels d'outils de Copilot aussi bien
que ceux de Claude Code. Codex ne sait pas poser de question à l'utilisateur : ce que Claude Code
soumet au propriétaire du projet y est signalé à l'utilisateur, et laissé aux vérifications du
pipeline.

Même sans plugin, un projet guide chaque agent : `init` écrit `AGENTS.md`, le guide que lisent
Codex, Copilot et la plupart des agents (`CLAUDE.md` l'importe ; sa section `## Verifying your
work` donne chaque commande de vérification avec les lignes qu'elle affiche quand elle passe, à
lancer avant de se dire fini et à coller, une vérification qui échoue corrigée dans le code et
jamais dans la vérification, et sa section `## Mistakes seen here` est celle de l'équipe : un
constat de revue ou un `TODO(review)` fait deux fois y devient une ligne, ou une règle de la
configuration, la règle de deux qu'appliquent l'agent `architecture-reviewer` et le *skill*
`quality-gate`, d'après le *playbook* AI-native SDLC d'Anthropic,
[PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)),
les règles par couche pour
Claude Code dans `.claude/rules/` et les mêmes règles pour Copilot dans `.github/instructions/`,
ciblées par `applyTo`, `REVIEW.md`, la politique de revue que lit chaque relecteur, écrite une
fois et possédée par l'équipe ([Travailler en équipe](team-workflow.fr.md#ce-que-la-revue-regarde-dans-chaque-couche)),
`.claude/settings.json`, les permissions de Claude Code (les vérifications et les générateurs
s'exécutent sans demander ; `.env` et les contrats générés ne sont jamais lus ni modifiés ;
`generate` et `init` avec `--force`, `git push`, `npm publish`, les fichiers qui portent les règles et le pipeline, les migrations de
l'ORM, `Dockerfile`, `docker-compose.yml` et `docker/` demandent d'abord : la liste est dans le
[README de la CLI](../../packages/cli/README.fr.md#init), et `ddd-ts-kit doctor` dit ce qu'un
projet en manque ; `init --agent-profile regulated` ajoute le bloc de bac à sable et les deux
*hooks* d'une organisation réglementée,
[Mettre les agents de code en bac à sable](agent-sandbox.fr.md#le-profil-réglementé)), et, avec le
pipeline GitHub, `copilot-setup-steps.yml`, qui installe le
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
| `plan-slices` | `status`, `story-check` et `worker-scope --rows` lisent les lignes de `slices.md` et refusent une ligne inconnue ; `plan-waves` rejoue les commandes de génération des lignes et refuse un nom dont le glossaire ne définit pas les mots, toute commande que le générateur refuse, avec son refus sous la ligne, et une ligne qui s'appuie sur ce que génère une ligne qu'elle n'attend pas ; `verify-slice` | l'ordre des lignes est conseillé (`plan-waves`), jamais refusé |
| `parallel-work` | la garde du *worker* (`.ddd-ts-kit/worker.json` : une écriture hors du contexte est refusée, par les outils d'édition et par le *shell*), `verify-merge`, `merge-trunk`, `status --workers` | |
| `intent` | `story-scope --from` refuse une intention dont le statut n'est pas `accepted` ; le bloc `## Origin` de la *story*, que `story --gate close` exige | le contenu d'une intention est lu par des personnes, pas vérifié |
| `story` | `story --gate build` et `--gate close`, la garde dans le *worktree* d'une *story* (pas de code avant la revue de conception et le verrou), `acceptance --lock`, `test/acceptance-black-box`, l'agent `acceptance-judge` | la passe de conception de `story-check` tient les noms, pas le comportement |
| `fix` | `story-scope --kind fix`, `acceptance <code> --gate written` et `--lock` sur les *specs* de régression de `## Regression`, la garde dans le *worktree* d'un correctif (pas de code avant le verrou, aucune édition d'une *spec* verrouillée par un sous-agent), l'agent `acceptance-judge` | la *spec* verrouillée est tenue inchangée ; qu'elle passe est prouvé par le lanceur de tests, pas par `acceptance` |
| `pull-request` | les vérifications de la *pull request* et la protection de branche (un *code owner* approuve) ; la garde du *worktree* de la *story* pendant qu'il travaille | rien du kit ne lit les fils de revue : le skill le fait |
| `scaffold` | la garde refuse un fichier de rôle écrit à la main ; `tree/closed`, `tree/documented-paths`, `naming/suffix`, `naming/one-concept-per-file`, `naming/business-name`, `naming/search-not-list`, `test/spec-required`, `test/builder-required`, `lifecycle/status-through-machine`, `process/sends-commands-only`, `scheduling/job-name`, `scheduling/job-registered`, `scheduling/job-triggers-use-case` | |
| `use-case` | les contrôles de `scaffold`, puis `application/handler-shape`, `application/command-query-separation`, `domain/aggregate-encapsulation`, `domain/value-object-class`, `domain/value-object-immutability`, `domain/no-generic-error`, `domain-events/dispatched-on-save`, `domain-events/transactional-before-commit`, `errors/code-listed`, `errors/code-unique`, `errors/through-factory`, `presentation/controller-shape`, `presentation/controller-delegates`, `schema/presentation-only`, `schema/no-duplicate-shape`, les tests du contexte lancés par `verify-slice` | |
| `integration-event` | `events/defined-in-published-language`, `events/name-declared-once`, `events/name-format`, `events/outbox-required`, `events/consumer-idempotent`, `event-sourcing/upcaster-required` (le verrou des événements stockés), le catalogue d'événements et le document AsyncAPI comparés par `docs --check` | |
| `wiring` | `ports/abstract-class`, `ports/no-token-constant`, `ports/no-concrete-dependency`, `ports/implements-never-extends`, `ports/value-import`, `declarations/role-declared`, `declarations/constructor-injection`, `declarations/barrel-current`, `declarations/port-adapter-wired`, `composition/only-in-module`, le *barrel* régénéré par `docs` | |
| `persistence` | `layer/domain-purity`, `layer/application-inward`, `files/port-not-connector`, `persistence/migration-history`, `persistence/primary-key-order`, `persistence/no-file-content`, `tenancy/scoped-statement`, les suites de contrat, le seuil de couverture de `infrastructure/` (`test/coverage-governed`) | un adaptateur sans sa suite de contrat n'est signalé par `test/spec-required` que quand son fichier de spec manque |
| `access-control` | `authz/declared`, `authz/granted`, `authz/in-application`, `authz/actor-explicit`, `authz/policy-asked`, `authz/scope-narrows`, `authz/resource-modelled`, `authz/system-actor-granted`, `authz/fields-by-schema`, `presentation/guard-at-the-edge` | |
| `cross-cutting` | `aspects/outside-in`, `tracing/platform-only`, `standard/no-parallel-interface`, `purity/no-system-clock`, `purity/no-ambient-randomness`, `purity/no-environment`, `presentation/shared-cache-varies` | |
| `testing` | `test/no-mocks`, `test/spec-required`, `test/builder-required`, `test/helper-placed`, `test/coverage-governed`, `test/acceptance-black-box`, la forme d'un test (`test/no-only-no-skip`, `test/title-states-a-rule`, `test/no-logic`, `test/assertion-present`, `test/refusal-by-code`, `test/no-snapshot`), le verrou de l'acceptation | une *spec* de régression n'est verrouillée que dans une *story* de correctif |
| `clean-code` | `clean/stepdown`, `clean/function-size`, `clean/file-size`, `clean/blank-lines`, `clean/braces`, `clean/one-export-per-file`, `clean/no-escape-hatch`, `clean/no-commented-out-code`, `clean/no-noise-comment`, `clean/no-flag-argument`, `clean/no-hash-private`, `clean/no-magic-number`, `clean/formatted` (Biome dans le *hook* de *commit* et dans le *pipeline*), `language/no-technical-name` | le formateur tourne au *commit* et en CI, pas à l'écriture |
| `document` | `docs --check` (`npm run docs:check`, la porte `docs` du *pipeline*), `declarations/barrel-current`, `tree/context-doc`, `sdk --check` | |
| `extract-service` | `context/extractable`, `context/published-language-only`, `imports/alias-only`, le point d'entrée par contexte qu'écrit `generate service` et son test de démarrage | |
| `deviation` | `governance/recorded-deviation`, `config/suppression-needs-reason`, `config/rule-off-everywhere`, la garde demande l'avis du propriétaire avant une désactivation, un test sauté ou un changement des règles | |
| `quality-gate` | `npm run verify`, le *hook* `Stop` de la garde (il refuse de terminer tant que des erreurs d'architecture restent dans les changements non *committés*), le *job* `gate` du *pipeline* | |
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
