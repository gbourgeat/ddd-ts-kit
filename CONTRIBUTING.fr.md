[English](CONTRIBUTING.md) · **Français**
<!-- translation-of: CONTRIBUTING.md sha256:3cee6c67dadb9b0f -->

# Contribuer

Merci de prendre ce temps. ddd-ts-kit se construit en public, et chaque contribution compte : un
signalement de bug avec sa reproduction, une coquille, une traduction, un test, un adaptateur,
une règle. Cette page dit comment commencer, puis les règles que suit chaque changement.

## Votre première contribution

1. **Choisir un sujet.** Les issues étiquetées
   [good first issue](https://github.com/gbourgeat/ddd-ts-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
   ne demandent pas de connaître le checker en profondeur ; celles étiquetées
   [help wanted](https://github.com/gbourgeat/ddd-ts-kit/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
   sont plus grandes. Dites sur l'issue que vous la prenez, pour que deux personnes ne fassent
   pas le même travail. Pour une idée qui n'a pas encore d'issue, ouvrez d'abord une
   [discussion](https://github.com/gbourgeat/ddd-ts-kit/discussions) ou une proposition.
2. **Installer.** Forkez le dépôt, clonez-le, et lancez les commandes ci-dessous : ce sont
   celles que lance la CI. Node 22.12 ou ultérieur.
3. **Changer, puis vérifier ce que vous avez touché.** Un changement de documentation demande
   `npm run check:dashes`, `npm run docs:translations` et, s'il contient un exemple de code
   vérifié, `npm run docs:samples` ; un changement de code demande la construction, les tests et
   le lint. Chaque package est tenu à 100 % de ses lignes (`vitest.config.ts`) : le nouveau code
   vient avec ses specs. Une vérification qu'aucune spec ne peut atteindre est retirée, ou laissée hors
   de la mesure dans [l'enregistrement de décision de la mesure](docs/adr/0001-lines-left-out-of-the-coverage-measure.fr.md),
   jamais déplacée sur une ligne déjà exécutée. Les *hooks* du plugin sont tenus à 100 % de leurs lignes, branches
   et fonctions (`npm run test:plugin`) : une branche qu'aucun test n'atteint le fait échouer, et
   une branche qu'aucune entrée de *hook* ne peut atteindre est retirée.
4. **Ouvrir une pull request.** Son titre est un sujet de commit conventionnel ; son modèle
   demande ce qui change, pourquoi, et comment cela a été vérifié. Chaque pull request est relue
   par le mainteneur.

Les contributions particulièrement bienvenues :

- un adaptateur pour un broker, un ORM, un framework HTTP ou une bibliothèque de validation que
  le kit ne prend pas encore en charge : il implémente le port et passe la suite de contrat de
  ce port ;
- des tests pour les branches d'un package qu'aucune spec ne prend encore ;
- la documentation : une page qui vous a paru obscure, un exemple qui manque, une traduction ;
- un retour d'un vrai projet : ce qui a tenu, ce qui a gêné, dans les
  [Discussions](https://github.com/gbourgeat/ddd-ts-kit/discussions).

Vous n'écrivez pas le français ? Dites-le dans la pull request : le mainteneur peut écrire la
page française dans la même pull request.

## Commandes

```bash
npm ci
npm run build
npm test
npm run lint
npm run format:check
node packages/cli/dist/bin.js check --self
npm run check:dashes
npm run check:parity
npm run docs:translations
npm run docs:samples
npm run test:plugin
```

`npm run lint` est ESLint avec un cache par contenu (`.eslintcache/`, 1 à 2 secondes quand rien n'a changé). Le hook de
pre-commit et le job Lint d'une pull request lancent Oxlint à la place (`npm run lint:oxlint`, avec les types, les
règles du kit chargées comme plugin JS, configuré par `.oxlintrc.json`) ; le trunk et la nuit lancent ESLint sur tout
l'arbre, qui porte aussi `no-unsafe-enum-assignment`, et le job d'essai compare les deux. Un changement de
`eslint.config.mjs` atteint `.oxlintrc.json` dans le même commit. Vitest garde les modules transformés des sources dans
`node_modules/.vitest-cache` (actif par défaut, ignoré par git, non conservé par la pipeline) : il rend une deuxième
exécution d'un package environ 40 pour cent plus rapide, et `rm -rf node_modules/.vitest-cache` le vide.

`zero-violation.spec.ts` et `formatted.spec.ts` génèrent chaque pile : ils ne tournent que dans les
tranches de bout en bout (`DDD_TS_KIT_E2E=1`), ni dans `npm test` ni dans le *hook* `pre-push`.

### Les commandes lourdes sur une station de travail

Une exécution de la suite unitaire, de la suite d'intégration ou d'une famille de specs de bout en
bout prend 2,5 à 7 Go, et plusieurs à la fois (plusieurs sessions de code, un *hook*
`pre-push` à côté d'une exécution) ont déjà fait redémarrer un poste. Deux choses les bornent :

- **Un verrou pour la machine.** Les scripts `ci:test:*` et l'étape unitaire du *hook* `pre-push`
  passent par `pipeline/monorepo/heavy-lock.sh`, qui tient l'une de deux places (des fichiers de
  verrou dans `$XDG_RUNTIME_DIR`, `DDD_TS_KIT_HEAVY_SLOTS` change le nombre) : une troisième
  commande lourde attend une place et le dit, au lieu d'ajouter sa mémoire aux autres. Toute autre
  commande lourde y passe à la main, une exécution de Stryker sur l'exemple par exemple :
  `bash pipeline/monorepo/heavy-lock.sh npm run test:mutation`. Dans un *pipeline* (`CI` défini),
  ou sans `flock`, la commande s'exécute aussitôt.
- **Deux travailleurs Vitest dans les scripts de bout en bout.** `ci:test:e2e`,
  `ci:test:e2e:stacks` et les autres scripts `ci:test:*` des familles démarrent
  `VITEST_MAX_WORKERS=2` : les projets qu'ils génèrent ne prennent pas chacun la moitié des cœurs.
  Définissez `VITEST_MAX_WORKERS` vous-même pour le changer.

## Règles de base

- [docs/ARCHITECTURE.fr.md](docs/ARCHITECTURE.fr.md) est le seul document normatif. Un
  changement de règle commence là, puis atteint le checker, les templates et les skills dans
  la même pull request. Le test de bout en bout de la CLI (tout générer, puis vérifier) doit
  rester vert : le générateur et le checker ne sont jamais en désaccord.
- Les membres d'une famille de paquets (les quatre ORM, les brokers, les loggers) sont à
  parité : une option, ou une capacité d'un contrat, qu'un membre a, les autres l'ont aussi, ou
  `pipeline/monorepo/families.mjs` dit, membre par membre, pourquoi non. `npm run check:parity`
  échoue sur une asymétrie que personne n'a écrite, et sur une asymétrie écrite qui n'est plus
  vraie. Un comportement d'un adaptateur est prouvé par le contrat de son port dans
  `@ddd-ts-kit/testing`, jamais par une spec d'un seul paquet : une nouvelle option vient avec la
  capacité du contrat qui la prouve, que chaque membre exécute alors.
- Ce que `init` et les presets refusent, et ce que les membres d'une famille de flags (les ORM,
  les conteneurs, les frameworks HTTP, les brokers, les runners...) génèrent différemment, est
  écrit dans `packages/cli/test/support/support-matrix.ts`, chaque ligne `decided` ou `not yet`
  avec sa raison. `support-matrix.spec.ts` essaie chaque flag et chaque paire de flags, et génère
  chaque membre d'une famille avec toutes les capacités activées : un refus, un TODO de plateforme
  ou un paquet du kit qu'aucune ligne n'explique échoue, comme une ligne qui ne tient plus. Une
  ligne `not yet` est un manque qui reste en vue jusqu'à ce qu'une pull request le comble et
  retire la ligne. La même spec génère toutes les sortes de fichiers dans un projet
  multi-tenant sur chaque ORM et lit chaque appel du code généré à une classe ou une fonction du
  kit dont les options prennent un `tenant` (lu dans les sources des paquets) : un appel sans lui
  échoue, sauf si `TENANT_GAPS` dit pourquoi.
- Une ligne de ces deux registres rend vert un contrôle qui échouait : c'est donc une décision du
  mainteneur, jamais le plus court chemin vers une CI verte. Sa raison dit ce que fait le membre
  à la place (une raison trop courte, ou une promesse pour plus tard, échoue), la CI d'une pull
  request annote chaque ligne qu'elle ajoute (`pipeline/monorepo/asymmetries.mjs`), et dans
  Claude Code le hook de `.claude/settings.json` demande avant toute modification de ces
  fichiers, quel que soit le mode de permission.
- Une nouvelle règle de vérification vient avec une fixture qui passe et une fixture qui
  échoue, une phrase `fix` et une entrée `explain`.
- Un changement qui fait signaler aux contrôles ce qu'ils ne signalaient pas (une nouvelle
  règle, une règle qui juge plus de fichiers, une limite abaissée) ne fait jamais passer au rouge
  un projet vert dans une version de correctif ou une version mineure : ce qu'il ajoute arrive
  d'abord dans les projets comme un avertissement, et devient une erreur une version mineure
  plus tard. Une nouvelle règle prend `warn` par défaut (`default-severities.ts` pour
  `ddd-ts-kit check`, `recommended: 'warn'` pour la règle ESLint, avec
  `transition: '<version mineure suivante>'` dans sa définition) ; une règle qui juge davantage
  signale ce qu'elle ajoute sous un identifiant de règle à part, en avertissement, fondu dans la
  règle à la version mineure suivante. Son fichier de `changes/` le dit, et celui qui en fait une erreur le redit : ce que la règle signale, la correction, et
  `ddd-ts-kit check --rule <id>` pour lister les fichiers à reprendre avant qu'elle ne bloque. Un
  projet continue de construire pendant qu'il monte de version ; une règle qui arrive en erreur
  arrête sa branche principale et toutes les branches qui en partent. Un projet généré fait
  échouer son lint sur un avertissement (`ddd-ts-kit lint`) : c'est la `transition` d'une règle
  ESLint qui tient la promesse, puisque cette commande affiche les avertissements d'une règle en
  transition sans échouer sur eux. La version mineure suivante passe `recommended: 'error'` et
  retire `transition`.
- Un nouveau template compile tel qu'il est généré et ne porte de marqueurs `TODO(domain)` que
  là où une connaissance du métier est nécessaire.
- Les packages d'exécution gardent les bibliothèques tierces derrière des dépendances pairs
  (peer dependencies) optionnelles et des points d'entrée par sous-chemin.
  `@ddd-ts-kit/kernel` et la CLI n'ont aucune dépendance d'exécution.
- Les skills restent courtes : elles disent à un agent quoi lancer et quoi décider, et
  renvoient à la référence au lieu de la répéter.
- Une page de documentation dit ce que fait le code aujourd'hui : un exemple compile avec les
  packages actuels, une commande s'exécute telle qu'elle est écrite, et ce qui n'a pas pu être
  vérifié est dit sur la page. [docs/README.fr.md](docs/README.fr.md) en est l'index.
- L'anglais dans le code, les messages de commit, la CLI et le checker. Chaque page de
  documentation a une traduction française à côté d'elle (`X.fr.md`), tenue à jour dans la
  même pull request : voir [docs/translation.fr.md](docs/translation.fr.md) pour les conventions,
  le glossaire, le style des schémas et les exemples de code vérifiés
  (`npm run docs:translations` et `npm run docs:samples`, lancés par la CI).
- Le site de la documentation (`site/`, publié à <https://gbourgeat.github.io/ddd-ts-kit/fr/>)
  est construit à partir de ces mêmes pages, qui restent sa seule source. `npm run site:dev`
  assemble les pages et sert le site sur `http://localhost:4321/ddd-ts-kit/` (relancez-le après
  avoir changé une page) ; `npm run site:build` le construit comme la CI, et échoue sur un lien
  ou une ancre qui ne mène nulle part. Une nouvelle page reçoit sa route dans
  `site/scripts/routes.mjs`. La carte qu'affiche un lien partagé est dessinée dans
  `site/src/assets/social-card.svg` ; `npm run social-card --workspace site` la rend dans
  `site/public/social-card.png`, versionné.
- Ni tiret cadratin ni tiret demi-cadratin, dans aucune langue (`npm run check:dashes`, lancé
  par la CI).
- Des commits conventionnels : `<type>(<scope>): <summary>`.
- Ce qu'une pull request change pour un utilisateur s'écrit dans un fichier à elle,
  `changes/<what-it-does>.md` ([changes/README.md](changes/README.md)), jamais dans
  `CHANGELOG.md` ; une pull request qui change le plugin (skills, agents, hooks) en a un, laisse
  `version` de `plugin/.claude-plugin/plugin.json` tel quel, et passe
  `claude plugin validate . --strict`. Deux pull requests n'écrivent alors jamais la même ligne :
  l'une fusionnée laisse les autres fusionnables telles quelles, leurs vérifications toujours
  valables. Le *job* de contrôles statiques de la CI le tient (`node pipeline/monorepo/changes.mjs --check --base <ref>`).

## La suite d'évaluation du plugin

Le plugin est une configuration d'agent : des *skills*, des agents, un *hook*. Un changement de
formulation peut casser sans bruit ce qu'une *skill* promet, et aucun test unitaire ne lit une
*skill*. La suite sous `plugin/evals/` est son test de régression, lancée par
`claude plugin eval` (Claude Code 2.1.269 ou ultérieur) : chaque cas est un *prompt* soumis à
une session sur un projet de référence, et des évaluateurs qui lisent ce que la session a fait.
Le [playbook du cycle de vie AI-native d'Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)
demande exactement cela de toute configuration qui pilote un agent.

Un cas est un répertoire de `plugin/evals/` :

- `case.yaml` le nomme et nomme son script de préparation, `fixture.sh`, qui charge
  `plugin/evals/lib/scheduling-example.sh` (l'exemple scheduling copié dans l'espace de travail
  vide de l'exécution, le `node_modules` de ce dépôt lié pour que `npx ddd-ts-kit` soit la CLI
  construite, un *commit* git) et plante ce dont le cas a besoin : une violation, une *story*,
  un verrou ;
- `prompt.md` tient le *prompt*, avec `max_turns`, `timeout_seconds` et `allowed_tools` dans
  son en-tête (`Bash`, `Edit` et `Write` sont accordés à l'exécution par `--allow-tools`) ;
- `graders/*.md`, un évaluateur par fichier : les déterministes d'abord (`tool_used` avec un
  `input_match`, `regex` sur le dernier message ou sur un fichier, `file_exists`), puis un juge
  `llm` pour ce que seule une lecture peut dire. Un cas passe quand son score atteint le seuil.

Trois règles tiennent la suite. Chaque régression qu'un utilisateur signale sur une *skill*, un
agent ou le *hook* devient un cas avant d'être corrigée, nommé d'après la promesse qu'il tient.
Chaque exécution a deux bras, avec le plugin et sans lui (la base sans plugin) : un cas que le
bras sans plugin passe aussi ne mesure rien, et il est retiré ou affûté jusqu'à distinguer les
deux. Un cas reste peu coûteux : un *prompt* précis, un nombre de tours borné, l'exemple comme
projet de référence plutôt qu'un projet à générer.

**La suite est désactivée par défaut.** Elle dépense des crédits d'API : chaque cas est une
session complète de Claude Code, lancée dans les deux bras et `--runs` fois (3 par défaut), si
bien que les douze cas font 24 sessions avec `--runs 1` et 72 avec le défaut, et qu'une
exécution nocturne de vingt cas ferait soixante sessions par nuit. Rien ne tourne sur une *pull
request*, à heure fixe, ni dans `npm test`. Un mainteneur la lance à la main depuis l'onglet
Actions (le *workflow* `agent-evals.yml`, `workflow_dispatch` seulement) une fois le secret
`ANTHROPIC_API_KEY` ajouté au dépôt ; sans le secret, le *job* le dit et se termine au vert.
Cette exécution utilise `--runs 1`, `--threshold 0.8` et un plafond de 10 USD, publie le rapport
comme artefact et écrit les scores dans son résumé ; les déclencheurs `pull_request` et
`schedule` en commentaire dans le fichier montrent comment l'activer, le coût indiqué à côté.

Pour lancer un cas en local, sur vos propres identifiants, la CLI construite (`npm run build`) :

```bash
claude plugin eval plugin --runs 1 --no-publish --max-cost-usd 5 --case describe-not-tree-walk \
  --scaffold --allow-tools Bash Write Edit --trust-plugin --output-dir /tmp/ddd-ts-kit-evals
```

`--scaffold` lance le `fixture.sh` du cas (ne le passez jamais pour une suite que vous n'avez pas
lue), `--max-cost-usd` est un plafond ferme, et `--output-dir` garde les résultats hors de
l'arbre (`plugin/evals/results/`, le défaut, est ignoré par git mais lu par
`npm run check:dashes`). Accorder le *shell* demande le bac à sable de Claude Code, `bubblewrap`
et `socat` sous Linux : sans eux l'exécution est refusée plutôt que lancée sans confinement, et
un cas qui n'accorde aucun outil (`deviation-refused`) tourne quand même. Un cas, une fois,
pendant que vous l'écrivez : la suite entière est l'exécution du mainteneur. La forme d'un cas se
vérifie sans rien lancer : `claude plugin eval` n'a pas d'exécution à blanc, donc analysez chaque
`case.yaml`, l'en-tête de chaque `prompt.md` et de chaque évaluateur avec un analyseur YAML, et
comparez avec le modèle qu'écrit `claude plugin eval init --bare <name>`.

## Comment un changement atteint `main`

`main` est protégée : aucun push direct, aucun push forcé, un historique linéaire. Un
changement arrive par une pull request dont le titre est un sujet de commit conventionnel, est
réduit à un seul commit (squash), et fusionne une fois que le job `gate` de la CI, la
vérification du titre et l'analyse CodeQL sont passés et que chaque conversation de revue est
résolue. Activez la fusion automatique et passez à autre chose :

```bash
gh pr create --fill
gh pr merge --auto --squash
```

Ce que la CI exécute dépend de la pull request (`docs/proposals/generated-project-families.fr.md`).
Ouvrez-la en brouillon tant que la branche n'est pas définitive : un brouillon n'exécute que les
vérifications rapides, et la marquer prête exécute toute la CI. Une pull request qui ne change que des
documents, le site, le texte du plugin ou l'exemple ne génère aucun projet ; une qui touche quoi que
ce soit sous `packages/` ou `pipeline/`, ou la configuration racine, génère un ensemble couvrant de 16 stacks où chaque valeur de chaque drapeau apparaît.
Le tronc génère toutes les stacks, installe sur npm et exécute l'alias sur Node 24 ; la nuit et la
pull request d'une release (titre `chore(release)` ou branche `release/*`) ajoutent pnpm, Node 22,
les états intermédiaires de la première minute, la porte de couverture sur dix stacks, les paires et
les migrations.

Les workflows épinglent chaque action à un commit, avec sa version en commentaire ; Dependabot
propose les mises à jour. Une vulnérabilité se signale en privé : voir
[SECURITY.fr.md](SECURITY.fr.md). Conduite : [CODE_OF_CONDUCT.fr.md](CODE_OF_CONDUCT.fr.md).

## Publier une version

Les packages de `packages/` sont publiés ensemble, sous une seule version.

```bash
node pipeline/monorepo/release-version.mjs --set 0.2.0   # chaque manifeste et les versions qu'écrit la CLI
npm install --package-lock-only
# pull request, fusion, puis sur main :
git tag v0.2.0 && git push origin v0.2.0
```

La pull request d'une release (son titre commence par `chore(release)`) fait tourner les projets
générés sur Prisma et TypeORM installés pour de vrai, comme la nuit (`npm run
ci:test:stacks-at-night`) les *stacks* qui font se rencontrer chaque paire de valeurs de
capacité (`npm run ci:test:pairwise`) et la première migration de chaque ORM sur un vrai
PostgreSQL (`npm run ci:test:migrations`) : la CI d'une autre pull request ne fait que typer les
premiers et laisse les secondes à la nuit. L'étiquette
lance le workflow `Release` : il les fait tourner une fois de plus et ne publie rien tant que l'un
d'eux est rouge (posez l'étiquette une fois les jobs `managers`, `pairwise` et `migrations` de la pull request de la release
verts, ou un run de la nuit demandé sur `main`, `gh workflow run ci.yml --ref main` : l'étiquette pointe sur ce code ; si `generated-stacks` échoue quand même, rien n'a atteint
npm : corrigez sur `main`, supprimez l'étiquette, `git push --delete origin v0.2.0 && git tag -d
v0.2.0`, et posez-la sur le commit corrigé avec la même version), puis vérifie que l'étiquette est la version qu'annonce chaque package, construit, vérifie les archives, publie chaque package sur le registre npm avec
sa provenance et crée la release GitHub. Une version qui a une partie de préversion
(`0.2.0-rc.1`) est publiée sous l'étiquette `next`. Une exécution arrêtée à mi-chemin se
relance : ce qui est déjà publié est sauté. Les notes de la release GitHub sont générées à
partir des pull requests fusionnées ; `CHANGELOG.md` à la racine dit en quelques lignes ce qu'une version change pour un utilisateur :
fixer la version y fond les fichiers de `changes/`, dans l'ordre où ils ont atteint `main`, et les
supprime ; le package de la CLI en livre une copie, que les agents lisent dans `node_modules`. Le
*plugin* sort avec les packages, sous leur version : la fixer écrit aussi `version` de
`plugin/.claude-plugin/plugin.json` et la version que décrivent les skills, dans
`plugin/hooks/guard.mjs`, pour que chaque agent affiche un seul numéro. Le *plugin* se numérotait
à part jusque-là, en avance sur les packages : la première version commune est au-dessus de la
sienne, ce que `--set` tient (il nomme la première version qu'il accepte), et `--expect` du
workflow de release tient le *plugin* à l'étiquette. Un correctif urgent du *plugin* est une
release de correctif du kit, pas une version à lui.

**Aucun secret.** Le workflow publie par la publication de confiance (trusted publishing,
OIDC) : chaque package désigne `release.yml` de ce dépôt, dans son environnement `npm`, comme
son éditeur de confiance, et `npm publish` échange le jeton d'identité du job contre un jeton
qui ne vit que le temps de cette publication. Le job garde `id-token: write` et
`environment: npm`, et a besoin de npm 11.5.1 ou ultérieur, ce qu'il vérifie. Aucun
`NPM_TOKEN` n'est stocké nulle part.

**Un nouveau package.** La confiance se déclare package par package, et seulement pour un
package qui existe sur le registre. Avant la première version publiée qui contient un package
ajouté à `packages/`, un mainteneur réserve son nom avec une version d'attente `0.0.0`,
dépréciée, et déclare le workflow comme son éditeur de confiance ; les vraies versions sont
ensuite publiées par le workflow, avec leur provenance :

```bash
mkdir /tmp/reserve && cd /tmp/reserve
npm init -y --scope=@ddd-ts-kit && npm pkg set name=<package> version=0.0.0 license=MIT
npm publish --access public --tag reserved
npm deprecate <package>@0.0.0 "Placeholder that reserves the name: install a released version."
npm trust github <package> --file release.yml --repository gbourgeat/ddd-ts-kit --environment npm --allow-publish
```

Tant que ce n'est pas fait, la publication échoue sur ce seul package, et l'étape de
publication le nomme ; relancer le job en échec après la déclaration le publie et saute les
autres.
