[English](agent-sandbox.md) · **Français**
<!-- translation-of: agent-sandbox.md sha256:7d4c361a12f8631f -->

# Isoler les agents de code : sécurité et charge de la machine

**Résumé.** Un agent de code lance des commandes sur votre machine avec vos droits : il peut lire
vos clés, joindre n'importe quel hôte et, avec plusieurs *workers* à la fois, prendre tous les
cœurs et toute la mémoire jusqu'à bloquer la machine ou la faire redémarrer. La garde du
*plugin* n'est pas une frontière de sécurité (elle laisse passer en cas de panne, par
conception) ; un bac à sable, si. Ce guide dit ce qui charge une machine dans un projet
ddd-ts-kit et ce que le kit fait déjà, puis trois niveaux d'isolation, du plafond de ressources
au bac à sable complet : le bac à sable de l'agent lui-même, et
[NVIDIA OpenShell](https://docs.nvidia.com/openshell/), celui que ce guide conseille quand la
sécurité d'une session compte. Ce qu'il dit d'OpenShell a été lu dans sa documentation le
2026-10-19, pour la version 0.1.4.

## Ce qui charge la machine, et ce que fait le kit

| Charge | Quand | Ce que fait le kit |
|---|---|---|
| les *specs* unitaires et leur couverture | avant chaque *push* (lefthook) | le *hook* lance `ddd-ts-kit affected --base origin/HEAD --run ci:test:unit` : les *specs* des contextes que la branche atteint et de ceux qui en dépendent, comme sur une *pull request* ; tout quand git ne sait pas le dire ; rien quand seuls des documents ont changé. Le *pipeline* lance toujours tout sur le tronc et chaque nuit |
| les *workers* du lanceur de tests | à chaque exécution | hors *pipeline* (pas de variable `CI`), Vitest et Jest prennent la moitié des cœurs (`maxWorkers: '50%'` dans la configuration générée, et dans le `vitest.config.ts` du kit lui-même) ; `VITEST_MAX_WORKERS=2`, ou `--maxWorkers=2` pour Jest, fixe le nombre |
| plusieurs agents à la fois | [travail en parallèle](parallel-work.fr.md) | chaque *worker* a son *worktree* avec ses propres `node_modules`, compilateur, *linter* et lanceur de tests : la charge est multipliée par le nombre de *workers*. Lancez les vagues de [Vagues et lots](parallel-work.fr.md#vagues-et-lots) avec autant de *workers* que la machine en tient, pas un par contexte |
| la vérification d'architecture en fin de tour | le *hook* `Stop`, quand des changements attendent | un `ddd-ts-kit check` du projet, 60 secondes au plus ; rien à régler |
| l'éditeur | toujours | un IDE indexe chaque *worktree* de `.worktrees/` avec ses `node_modules` : marquez le dossier comme exclu |

Pour dimensionner les vagues, lancez un `verify-slice` d'un *worker* et observez son pic de
mémoire : le nombre de *workers* est ce que la mémoire libre contient de ce pic, avec une marge.

Une machine qui redémarre au lieu de tuer un processus a souvent trop chaud ou manque
d'alimentation, plutôt que de mémoire : Linux tue un processus quand la mémoire manque. Après un
redémarrage, `journalctl -k -b -1 | grep -iE "oom|thermal|mce"` dit lequel.

## Trois niveaux d'isolation

| | Plafond de ressources | Bac à sable de l'agent | NVIDIA OpenShell |
|---|---|---|---|
| Protège | la machine de la surcharge | les fichiers et les hôtes atteints par les commandes *shell* | les fichiers, le réseau, les identifiants et les appels système de tout l'agent |
| Processeur et mémoire | oui | non | oui (`--cpu`, `--memory`) |
| *Hooks*, outils de fichiers, serveurs MCP | plafonnés | hors de la frontière | dans la frontière |
| Identifiants | visibles de l'agent | visibles sauf refus | injectés par la passerelle, jamais vus par l'agent |
| Vos fichiers | en place | en place | copiés à l'aller et au retour, ou clonés à l'intérieur |
| Mise en place | une commande | un réglage | une image et une politique |

### 1. Plafonner les ressources (Linux)

Lancez l'agent dans un *scope* systemd : tout ce qu'il démarre, *workers*, lanceurs de tests et
compilateurs compris, partage le plafond, et le noyau tue à l'intérieur du *scope* au lieu de
bloquer la machine.

```sh
systemd-run --user --scope -p MemoryHigh=10G -p MemoryMax=12G -p CPUQuota=600% claude
```

Environ 70 % de la mémoire, et un `100%` par cœur que vous lui donnez. `earlyoom` ou
`systemd-oomd` tuent plus tôt que le noyau. Cela protège la machine, pas vos données : l'agent
garde vos droits.

### 2. Le bac à sable de l'agent

Claude Code a un bac à sable pour ses commandes *shell* : `/sandbox` dans une session, ou
`"sandbox": { "enabled": true }` dans ses réglages. Sous Linux, il lui faut `bubblewrap` et
`socat`. Il limite les fichiers qu'une commande écrit et les hôtes qu'elle joint à travers un
*proxy* (`network.allowedDomains` : le registre npm et votre hôte git pour un projet
ddd-ts-kit). Les *hooks*, les outils de fichiers et les serveurs MCP tournent en dehors, et il
ne limite ni le processeur ni la mémoire : associez-le au niveau 1. Voir
[Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing). Codex a ses
propres modes de bac à sable.

#### Le profil réglementé

`npx ddd-ts-kit init --agent-profile regulated` écrit ce niveau dans le projet, tel que l'exemple
du *playbook* AI-native SDLC d'Anthropic
([PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf))
le déroule pour une organisation réglementée, et l'enregistre sous `agents.profile` dans
`ddd-ts-kit.config.json` ([`ddd-ts-kit.config.json`](../CONFIG.fr.md#accords-de-travail)). Il
s'applique à un projet déjà initialisé, sans `--force`, et `--agent-profile none` le retire. Avec
le profil, `.claude/settings.json` gagne un bloc `sandbox` à côté des permissions (une clé que le
projet avait déjà posée est gardée), et `init` affiche le bloc de réglages gérés qu'un fichier de
projet ne peut pas poser, pour que l'équipe plateforme le colle ; `ddd-ts-kit doctor` signale un
projet dont les réglages manquent d'une ligne du bloc, ou dont les permissions ne laissent aucune garde (`defaultMode` à `bypassPermissions`, ou une règle d'autorisation `Bash(*)` ou `Bash`) (`--strict` échoue dessus). Ce que chaque
ligne apporte, en termes de contrôle :

| Ligne | Où | Ce qu'elle apporte |
|---|---|---|
| `sandbox.enabled: true` | `.claude/settings.json` | chaque commande *shell* de l'agent tourne dans le bac à sable (bubblewrap et socat sous Linux) : elle écrit où le bac à sable l'autorise et joint le réseau par son *proxy* |
| `sandbox.failIfUnavailable: true` | projet | sur une machine sans bac à sable, la session s'arrête au démarrage au lieu de lancer les commandes hors bac à sable : aucune dégradation silencieuse |
| `sandbox.allowUnsandboxedCommands: false` | projet | l'agent ne peut pas lancer une commande hors du bac à sable (la demande `dangerouslyDisableSandbox` est ignorée) : aucune nouvelle tentative en contournant le contrôle |
| `sandbox.autoAllowBashIfSandboxed: false` | projet | une commande n'est pas lancée du seul fait qu'elle tourne dans le bac à sable : la clé vaut `true` par défaut, et une règle `ask` sur `Bash` sans contenu est alors sautée pour chaque commande du bac à sable, si bien que la liste d'autorisations ne serait plus une barrière ; les règles `deny` et les règles `ask` limitées à un contenu tiennent dans les deux cas (documentation de Claude Code, lue le 2026-10-31) |
| `sandbox.network.allowedDomains: ["registry.npmjs.org", "<hôte git>", ...]` | projet | une commande joint le registre des paquets, l'hôte git du projet (lu dans `repository` de `package.json`, sinon dans le *remote* `origin` ; ajoutez votre miroir si vous en tenez un) et les hôtes d'où les scripts d'installation de la pile téléchargent (plus bas), et rien d'autre : aucune exfiltration par `curl`, aucun paquet d'un hôte inconnu |
| `sandbox.filesystem.allowWrite` : les caches qu'écrit l'installation de la pile | projet | une commande n'écrit que le projet, le répertoire temporaire et ces caches : `~/.npm` avec npm, le *store* et le cache de pnpm, `~/.cache/prisma` avec Prisma (plus bas) |
| `sandbox.credentials.files` : `~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.azure` refusés | projet | une commande ne peut pas lire les clés du développeur : une injection de *prompt* ne peut pas les envoyer |
| `sandbox.credentials.envVars` : `GITHUB_TOKEN`, `GH_TOKEN`, `GITLAB_TOKEN`, `NPM_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_CLIENT_SECRET` refusées | projet | les variables sont retirées avant chaque commande en bac à sable : un jeton dans le *shell* du développeur n'est pas dans celui de l'agent |
| `permissions.deny: Read(./.env)`, `Read(./.env.local)`, `Read(./.env.*.local)`, `Read(./.env.production)`, `Read(./.env.development)`, `Read(./.env.test)`, `Read(./.env.staging)`, `Read(./.env.stage)`, `Read(./.env.prod)`, `Read(./.env.preview)`, `Read(./.env.ci)`, `Read(./.envrc)` | projet, écrit aussi sans le profil | les secrets du projet restent hors du contexte de l'agent : le bac à sable ne couvre que les commandes *shell*, pas l'outil Read, donc une règle de permission tient celui-ci |
| `allowManagedPermissionRulesOnly: true` | réglages gérés | les règles de permission de l'organisation sont les seules : un fichier de projet ou d'utilisateur ne peut pas les élargir |
| `permissions.disableBypassPermissionsMode: "disable"` | gérés | le mode qui saute chaque demande de permission est refusé : aucune session ne tourne sans les portes |
| `allowManagedHooksOnly: true` | gérés | seuls les *hooks* de l'organisation tournent ; copiez-y les *hooks* du profil, sinon un fichier de projet ne peut pas les garder. Un projet ne peut pas retirer la porte de production |
| `strictKnownMarketplaces: [{ "source": "github", "repo": "gbourgeat/ddd-ts-kit" }]` | gérés | les *plugins* viennent des *marketplaces* que l'organisation nomme (celle du kit, ou votre miroir) : aucun *skill* non relu |
| `requiredMinimumVersion: "<version>"` | gérés | un Claude Code plus ancien que la version nommée ne démarre pas : chaque session a les contrôles de cette version |
| `hooks.PreToolUse` : `production-gate.mjs` sur `Bash` | projet, `.claude/hooks/` | une commande qui nomme l'environnement de production avec une action de mise en production ne tourne pas sans approbation nommée : l'autorisation de mise en production du processus de changement, tenue au moment où la commande tournerait |
| `hooks.PreToolUse` : `change-reference.mjs` sur `Edit\|Write\|MultiEdit` | projet, `.claude/hooks/` | une modification d'une migration ou des conteneurs est confirmée par une personne avec une référence de changement en tête, enregistrée comme *trailer* `Change:` du *commit* : le ticket de changement du processus, sur ce qui atteint la production autrement que par le code |

Les réglages gérés vivent hors du dépôt (`managed-settings.json`, déployé par l'équipe
plateforme) : `init` les affiche comme un bloc à coller, la version laissée à l'équipe. Associez
le profil au niveau 1 pour la charge de la machine.

Les deux *hooks* sont de petits scripts Node qu'`init` écrit une fois sous `.claude/hooks/` (pas
de `jq`, rien à installer), enregistrés sous `hooks.PreToolUse` de `.claude/settings.json`,
possédés par l'équipe dès lors, et signalés par `doctor` quand un fichier ou un enregistrement
manque. Chacun s'explique à l'agent :

- `production-gate.mjs` tourne avant chaque commande `Bash`. Une commande qui nomme
  l'environnement de production du projet (les mots de `PRODUCTION_ENVIRONMENTS` en tête du
  fichier, `production` par défaut, lu entre des séparateurs quelconques : `deploy-production` et
  `deploy_production` le nomment comme `deploy:production`, `non-production` et `pre-production`
  non) avec une action de mise en production (`RELEASE_ACTIONS` :
  `deploy`, `migrate`, `rollback`) est bloquée, code de sortie 2, avec la raison que l'agent lit :
  la commande ne tourne qu'une fois qu'une personne a approuvé la mise en production, d'après la
  liste de contrôle de l'équipe, en posant `RELEASE_APPROVAL="<approbateur> <id du changement>"`
  dans l'environnement de la session ; le *hook* la laisse alors passer et dit qui a approuvé
  quoi. L'agent est prévenu de ne pas poser la variable lui-même. Les listes se modifient dans le
  fichier, ou s'étendent pour une session par les variables `PRODUCTION_GATE_ENVIRONMENTS` et
  `PRODUCTION_GATE_ACTIONS` (séparées par des virgules). Toute autre commande passe telle quelle.
- `change-reference.mjs` tourne avant chaque `Edit`, `MultiEdit` et `Write`. Un fichier sous
  `migrations/` ou `prisma/migrations/`, sous un dossier `docker/`, un `Dockerfile` ou un
  `docker-compose*.yml`, où qu'il soit dans le dépôt ou dans un *worktree* du projet, fait répondre au
  *hook* `permissionDecision: "ask"` : la personne confirme la modification avec une référence de
  changement en tête (l'identifiant du ticket de changement ou de la *story*), et la session
  l'enregistre comme *trailer* `Change: <id>` du *commit* qui porte le fichier
  (`git commit -m "<message>" -m "Change: <id>"`,
  [Discipline de commit](commit-discipline.fr.md#les-messages--conventional-commits)). Il demande, il
  ne bloque pas, et il reste muet pour tout autre fichier. Le *trailer* est lu par des personnes,
  dans l'historique, et par `npx ddd-ts-kit story-check <code>`, qui liste chaque *commit* d'une
  *story* qui change un de ces fichiers sans lui, et bloque dessus sous le profil réglementé ;
  les chemins que surveille le *hook* et ceux que lit `story-check` sont la même liste, tenue
  alignée dans le kit.

L'entrée et les codes de sortie d'un *hook* suivent la
[référence des hooks](https://code.claude.com/docs/en/hooks) de Claude Code, lue le 2026-10-23 :
le JSON de l'appel d'outil sur l'entrée standard (`tool_name`, `tool_input.command` pour `Bash`,
`tool_input.file_path` pour `Edit` et `Write`, `cwd`), le code de sortie 2 pour bloquer avec la
sortie d'erreur comme raison, le code 0 avec un `hookSpecificOutput` de `permissionDecision`
`ask` pour solliciter la personne. Les deux *hooks* sont enregistrés dans `.claude/settings.json`,
que seul Claude Code lit : Codex et Copilot ne lancent ni l'un ni l'autre, et ce qu'ils portent
y reste une règle de l'équipe.

Les noms et les formes des clés ci-dessus ont été vérifiés le 2026-10-23, et les listes du système
de fichiers et le bac à sable exigé par l'administrateur le 2026-10-27, dans la documentation de
Claude Code : [settings](https://code.claude.com/docs/en/settings),
[sandboxing](https://code.claude.com/docs/en/sandboxing),
[permissions](https://code.claude.com/docs/en/permissions) et
[managed settings](https://code.claude.com/docs/en/managed-settings). Ce qui n'a pas été
vérifié : la forme de la valeur de `requiredMinimumVersion`, que la page des réglages gérés nomme
sans exemple (une chaîne de version est ce pour quoi `init` laisse une place), et la portée de
`disableBypassPermissionsMode`, que la référence des réglages donne comme posable depuis
n'importe quel fichier mais qui ne tient que dans les réglages gérés, la valeur la plus stricte
l'emportant.

**Codex et Copilot.** Le profil est écrit pour Claude Code. Codex a son propre bac à sable,
configuré hors du dépôt (`sandbox_mode` et `approval_policy` de son `config.toml` :
`workspace-write` garde le réseau fermé sauf si son `network_access` dit autrement), l'équivalent
de `sandbox.enabled` et du bloc réseau sans liste par domaine ; les refus d'identifiants, les
*hooks* gérés, les *marketplaces* et la version minimale n'ont pas d'équivalent que le kit
connaisse, et ces noms n'ont pas été revérifiés pour cette page. L'agent cloud de Copilot tourne
dans un environnement hébergé par GitHub dont la liste d'hôtes autorisés se règle dans les
réglages du dépôt sur GitHub, pas dans un fichier du projet ; `.github/copilot/settings.json` n'a
pas de clé de bac à sable, donc le profil n'écrit rien pour Copilot. Les deux *hooks* du profil
ne tournent que dans Claude Code, comme dit plus haut.

#### La liste d'autorisations et la confiance dans l'espace de travail

Les règles `permissions.allow` de `.claude/settings.json` (la liste d'autorisations qu'écrit `init`,
et que relit le profil réglementé) ne s'appliquent que dans un espace de travail de confiance sur
la machine qui lance la session. Une exécution sans interface (`claude -p`, un clone neuf en CI,
un agent scripté) n'affiche jamais le dialogue de confiance ; dans un espace où personne ne l'a
accepté, Claude Code ignore ces entrées et écrit sur stderr `Ignoring N permissions.allow entries
from .claude/settings.json: this workspace has not been trusted`. Ce qui a été vérifié, avec
Claude Code 2.1.311 et un fichier de projet portant une règle `allow` et une règle `deny` : la
règle `allow` n'a pas été appliquée (la commande a été refusée), la règle `deny` l'a été. La
documentation de Claude Code ajoute que les règles `ask` ne sont pas touchées non plus, puisqu'elles
ne font que restreindre, et que les *hooks*, le bloc `env` et les serveurs de `.mcp.json` ne sont
pas soumis à la confiance dans une exécution `-p` (les *hooks* du profil tournent donc). La session
ne travaille alors qu'avec ce qu'accordent `--allowedTools` ou le mode de permission, ce qui peut
masquer le manque : une exécution qui passe `--allowedTools` ne prouve pas que la liste du projet
fonctionne.

Pour faire confiance à un espace de travail en exécution sans interface, ouvrez-le une fois dans
Claude Code et acceptez le dialogue, ou mettez `projects["<racine du dépôt>"].hasTrustDialogAccepted`
à `true` dans `~/.claude.json` du compte qui lance la session (l'équipe plateforme gère ce compte
en CI). La confiance est un état de ce fichier utilisateur, pas du dépôt : une équipe ne peut pas
la versionner. La documentation indexe la confiance sur la racine du dépôt git et dit qu'un
*worktree* git utilise la racine du dépôt principal : un nouveau chemin de *worktree* n'est donc
pas un espace de travail à part. Ce dernier point n'a pas été sondé ici, pas plus que l'effet des
réglages gérés sur les règles `allow` d'un projet ; avec `allowManagedPermissionRulesOnly: true`,
les règles de l'organisation sont de toute façon les seules. `ddd-ts-kit doctor` ne rapporte pas
la confiance : il faudrait ouvrir `~/.claude.json`, qui contient aussi des données de compte, et
une commande du kit ne lit pas ce fichier.

#### Les contrats générés sous le bac à sable

Le bac à sable de Claude Code transforme une règle de permission sur un fichier en règle du bac à
sable : une règle de refus `Read` en chemin qu'aucune commande du shell ne lit, une règle de refus
`Edit` en chemin qu'aucune commande du shell n'écrit, une règle d'autorisation `Edit` en chemin
qu'elles écrivent ([settings reference](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem),
lue le 2026-10-27). Une règle `ask` reste une règle des outils de fichiers. `init` n'écrit donc
aucune règle de refus `Edit` sur un fichier qu'écrit une commande du kit : les contrats
(`openapi/**`, `docs/integration/asyncapi.*`, `docs/integration/event-catalog.md`) et le verrou
d'une acceptation (`test/acceptance/*.acceptance.lock.json`) sont des règles `ask`, et la garde du
plugin refuse d'emblée leur modification par l'outil `Write` ou `Edit`. `npm run docs:generate`,
la fusion d'une branche qui les a régénérés et `ddd-ts-kit acceptance <story> --lock` les écrivent
dans le bac à sable.

Les versions précédentes les refusaient : dans une session sous le bac à sable, `docs:generate`
s'arrêtait alors sur `EROFS` au premier contrat. `init` relancé retire les quatre règles de
`permissions.deny`, les demande à la place et le dit dans ses notes. Une entrée `allowWrite` ne
lève pas une règle de refus sur le même chemin (constaté sous Linux avec Claude Code 2.1.311) :
déplacer les règles est la correction, pas ajouter des chemins.

#### Installer la pile sous le bac à sable

L'installation d'une pile écrit hors du projet et télécharge depuis d'autres hôtes que le registre.
Le profil réglementé ouvre ce dont la pile choisie par `init` a besoin, et rien de plus :

| Pile | `filesystem.allowWrite` | `network.allowedDomains` | Pourquoi |
|---|---|---|---|
| npm | `~/.npm` | le registre | le cache de npm |
| pnpm | `~/.local/share/pnpm/store`, `~/.cache/pnpm`, `~/Library/pnpm/store`, `~/Library/Caches/pnpm` | le registre | le *store* et le cache de pnpm, sous Linux puis sous macOS : le bac à sable ignore un chemin que la machine n'a pas |
| `--orm prisma` | `~/.cache/prisma` | `binaries.prisma.sh` | l'installation de `@prisma/engines` télécharge les moteurs dans ce cache, et `prisma generate` les y touche |
| `--broker kafka` | rien | `github.com`, `release-assets.githubusercontent.com` | `@confluentinc/kafka-javascript` télécharge son binaire précompilé depuis les *releases* de son dépôt, qui redirigent vers l'hôte des fichiers de *release* |

Avec ces entrées, un `npm install` du client Kafka, `prisma generate` et `prisma migrate diff`
réussissent sous le bac à sable (constaté sous Linux avec Claude Code 2.1.311). Trois cas ne sont
pas couverts par le fichier du projet, et `init` les dit dans ses notes :

- **La première installation.** Un chemin d'`allowWrite` qui n'existe pas au démarrage de la
  session reste en lecture seule pour toute la session : le bac à sable ne rend aucun nouveau
  répertoire inscriptible. Le propriétaire lance le premier `npm install` (ou `pnpm install`)
  depuis un terminal hors de l'agent, juste après `init` : il crée les caches, et il exécute les
  scripts d'installation de la pile sous les yeux du propriétaire. L'agent reprend à
  `npm run verify`, comme le dit le *skill* `bootstrap`, et ses installations suivantes,
  `npm ci` dans un *worktree* compris, tournent dans le bac à sable.
  Ces scripts s'exécutent parce qu'`init` les autorise par leur nom : `@prisma/engines` et
  `@confluentinc/kafka-javascript`, dans `allowScripts` de `package.json` sous npm, dans
  `allowBuilds` de `pnpm-workspace.yaml` sous pnpm, qui n'en exécute aucun autre. Un nom autorise
  toutes les versions suivantes, et le profil demande que chaque version soit relue : après la
  première installation le propriétaire les épingle,
  `npm install-scripts approve @prisma/engines @confluentinc/kafka-javascript` changeant chaque nom
  en la version installée (sous pnpm, `'<package>@<version>': true` dans `allowBuilds`, la version
  que donne `pnpm why <package>`). Une montée de version de l'un d'eux, une *pull request* de
  Dependabot par exemple, demande alors la même étape une fois son nouveau script relu : d'ici là
  `npx ddd-ts-kit doctor` la signale et `doctor --strict` échoue, tandis que npm 11.19 exécute
  encore le nouveau script avec un avertissement et que pnpm l'ignore (vérifié avec npm 11.19.1 et
  pnpm 12.11.2).
- **Pas de binaire précompilé du client Kafka.** Là où aucun ne convient à la machine (une
  plateforme ou une version de Node peu courante), le client compile librdkafka depuis les
  sources : un compilateur, `~/.cache/node-gyp`, `nodejs.org`, `zlib.net` et `curl.se`. Le profil
  n'en ouvre aucun, puisque la compilation ne pourrait pas réussir sans tous : cette installation
  se fait hors de l'agent à chaque fois.
- **Un bac à sable que les réglages gérés exigent.** Quand les réglages gérés, ou les `--settings`
  d'une session, mettent `sandbox.allowUnsandboxedCommands` à `false` (ou que les réglages gérés
  mettent `sandbox.network.allowManagedDomainsOnly`), Claude Code ignore `filesystem.allowWrite` et
  `network.allowedDomains` de `.claude/settings.json`
  ([sandboxing](https://code.claude.com/docs/en/sandboxing#repository-settings-under-an-admin-required-sandbox)) :
  l'équipe plateforme recopie les entrées du projet dans les réglages gérés.

Un cache inscriptible est partagé avec les autres projets du développeur. npm et pnpm vérifient ce
qu'ils y prennent contre l'intégrité du fichier de verrouillage ; Prisma vérifie un moteur contre
une somme de contrôle gardée à côté, dans le même cache, si bien qu'une session pourrait y laisser
un moteur qu'un autre projet exécuterait ensuite hors du bac à sable. Une équipe qui ne l'accepte
pas retire `~/.cache/prisma` de la liste, et le propriétaire lance `prisma generate` hors de
l'agent. `init` relancé ajoute une entrée dont la pile a besoin à une liste que le projet a déjà,
et garde les siennes ; `doctor` nomme une entrée qui manque à la liste.

#### La base de données sous le bac à sable

Une commande du bac à sable ne peut pas ouvrir de connexion TCP vers la base de données du projet,
quoi que contienne le bloc `sandbox.network`. Sondé sur Claude Code 2.1.311 sous Linux, avec
PostgreSQL à l'écoute sur `127.0.0.1` et un simple `net.connect` dans la session : `allowedDomains`
avec `localhost` et `127.0.0.1`, avec ou sans port, `allowLocalBinding: true` et
`allowAllUnixSockets: true` finissent tous en `ECONNREFUSED`. Le bac à sable donne à une commande
son propre réseau, dont la seule sortie est le proxy de la liste de domaines, et ce proxy relaie
HTTP et HTTPS, pas le protocole d'une base ; `allowLocalBinding` et `allowUnixSockets` sont des
réglages de macOS, ignorés sous Linux. Aucun réglage du bac à sable n'atteint une base locale : le
profil n'en écrit donc pas, et le seul réglage qui élargirait quelque chose (`allowAllUnixSockets`)
atteint un fichier socket, pas un port, et ouvre toutes les sockets de la machine, celle du moteur
de conteneurs comprise.

Dans une session sous le profil régulé, l'agent écrit donc le schéma et le code, et le propriétaire
(ou la chaîne) lance ce qui demande la base, depuis un terminal hors du bac à sable :

- `npm run db:migrate` sous tous les ORM (qui échoue sur la connexion) ;
- les migrations n'y figurent pas : `npm run db:generate <nom>` n'a besoin d'aucun serveur quand
  `DATABASE_URL` n'est pas définie. Sous Prisma et TypeORM, le kit démarre alors PostgreSQL en
  processus (PGlite servi sur le protocole réseau, le moteur de `openTestDatabase()`), y rejoue les
  migrations déjà écrites, compare le schéma et écrit la nouvelle migration, avec les instructions
  d'append-only de la piste d'audit. Drizzle génère depuis ses instantanés, et Knex compare
  `createTables` aux migrations sur PostgreSQL en processus, quoi que dise `DATABASE_URL`. Un agent
  dans le bac à sable génère donc ses propres migrations ; sous
  TypeORM, il compile d'abord (`npm run build && npm run db:generate migrations/<nom>`) ;
- les specs d'intégration et de bout en bout qui nomment une `DATABASE_URL` ; les specs sur les
  doublures en mémoire et les specs de bout en bout sans `DATABASE_URL` (base en processus) tournent
  dans la session.

Quand `DATABASE_URL` est définie et que son serveur ne répond pas (la retirer génère sur la base en processus), `prisma-generate` et
`typeorm-generate` s'arrêtent avant l'outil, sortent en 3 (le code de ce qu'une session ne peut pas
faire ici) et le disent, au lieu d'une erreur de connexion brute ; la commande est alors remise au
propriétaire telle quelle.

#### Les fichiers vides que laisse le bac à sable

Là où le bac à sable de Claude Code monte un chemin qu'il protège et que ce chemin n'existe pas,
il laisse dans le projet un fichier vide ou un périphérique `/dev/null` : `.mcp.json`,
`.claude/launch.json`, `.claude/scheduled_tasks.json`, `.claude/settings.local.json`, `loop.md`
et des fichiers cachés comme `.bashrc`. Ils ne font pas partie du projet, et un fichier JSON vide
n'est pas du JSON valide. Les configurations que `init` écrit passent à côté : `biome.json` écarte
`.claude` et `.mcp.json` et lit le fichier d'exclusion de git (pour qu'un magasin pnpm écrit dans
le projet, `.pnpm-store/`, que `.gitignore` liste avec pnpm, ne soit pas parcouru), et `knip.json`
pose `"mcp": false`, pour que Knip ne charge pas `.mcp.json`. Un projet écrit avant cela garde ses
anciens fichiers : ajoutez-y ces lignes, ou lancez `init --force`.

Le bac à sable peut aussi laisser un `.git/config.lock` en lecture seule. Supprimez-le depuis un
terminal hors du bac à sable avant `git config` ou `git branch -d`, qui refusent de s'exécuter
tant qu'il existe.

#### Créer le projet sous le bac à sable

Le bac à sable de Claude Code empêche l'agent d'écrire `.claude/settings.json`, `.claude/hooks/`
et `.git/hooks` : là où `init` écrit les réglages de l'agent et les *hooks* du profil réglementé,
et là où `npm run hooks:install` installe les *hooks* git. `init` écrit tous les autres fichiers
et liste ceux-là sous `unwritable` (et dans `skipped`) de son rapport, *dry run* compris, sort
avec le code 3 et finit par une note qui donne la commande pour finir : le même `init`, lancé depuis un terminal hors du bac à
sable, qui écrit les fichiers manquants et garde ceux déjà écrits. Le *skill* `bootstrap` confie
les deux au propriétaire du projet dès le départ : l'agent lance le *dry run* et montre la
commande, le propriétaire lance `init`, l'agent reprend à `npm install`, et le propriétaire lance
`npm run hooks:install` avant le premier *commit*. Sous le profil réglementé, le propriétaire
lance aussi ce premier `npm install`, juste après `init`, et l'agent reprend à `npm run verify`
([Installer la pile sous le bac à sable](#installer-la-pile-sous-le-bac-à-sable)).

### 3. NVIDIA OpenShell

[OpenShell](https://github.com/NVIDIA/OpenShell) est l'environnement d'exécution libre (Apache
2.0) que NVIDIA a publié en mars 2026 pour faire tourner des agents autonomes dans des bacs à
sable. Il fait tourner Claude Code, Codex, Copilot CLI, OpenCode et d'autres. Ce qu'il ajoute aux
deux niveaux précédents :

- **tout l'agent est à l'intérieur**, *hooks*, outils et serveurs MCP compris, comme un
  processus sans privilège tenu par Landlock et seccomp ;
- **le réseau est fermé par défaut** : une politique autorise chaque hôte, pour chaque binaire,
  avec les méthodes et les chemins permis ;
- **les identifiants restent dehors** : une passerelle ne les ajoute qu'aux requêtes destinées à
  un point d'accès autorisé, si bien qu'une injection de *prompt* ne peut pas lire votre clé
  d'API dans l'environnement ;
- **le processeur et la mémoire sont plafonnés** par bac à sable sous Docker et Podman ; un
  journal d'audit garde chaque décision d'autorisation et de refus.

**Prérequis.** Linux 6.2 ou plus récent avec Landlock (ABI 3) et seccomp, Docker 28 ou Podman 5 ;
macOS sur Apple Silicon avec Docker Desktop ; Windows via WSL 2 est expérimental. Le lancement
échoue fermé quand Landlock manque.

**Windows** n'est pris en charge que via WSL 2 (la plateforme y est `linux`). Hors de WSL,
`affected --run`, `verify-slice`, `worker-scope`, `story-scope`, `worktree` (sauf `--no-install` ou
`--dry-run`) et `merge-trunk` refusent de s'exécuter, dès leur entrée et avant qu'aucun processus ne
démarre : le gestionnaire de paquets est atteint par `cmd.exe`, qui passe sans les échapper les
arguments d'un script (`affected --run "test & calc"` exécuterait `calc`). Le refus sort avec le
code 2.

**Limites à connaître**, en 0.1.4 :

- aucun dossier de l'hôte n'est monté : les fichiers sont copiés à l'aller
  (`openshell sandbox upload`) et au retour (`openshell sandbox download`), ou le bac à sable
  clone le dépôt et pousse une branche. Votre éditeur ne voit pas les fichiers pendant que
  l'agent travaille ;
- `--upload` ne se combine pas avec la commande de `sandbox create` : créer, téléverser, puis
  `sandbox exec` ;
- la connexion documentée de Claude Code est `ANTHROPIC_API_KEY`, dont la CLI fait un
  *provider* ; une connexion par abonnement n'est pas documentée ;
- le pilote VM accepte `--cpu` et `--memory` sans les appliquer : utilisez Docker ou Podman ;
- le projet est jeune (0.1.x) : épinglez une version stable et lisez ses notes de mise à jour.

**Un projet ddd-ts-kit dans OpenShell.** Une image avec la version de Node du projet, git et
l'agent ; la politique par défaut du bac à sable, plus le registre npm et l'hôte git ; le plafond
de la machine. Les commandes ci-dessous sont celles que donne la documentation d'OpenShell ;
vérifiez-les pour votre version.

```dockerfile
# Dockerfile of the sandbox: Node of the project, git, the agent
FROM node:24-bookworm
RUN npm install --global @anthropic-ai/claude-code
```

```sh
export ANTHROPIC_API_KEY=...   # becomes a provider: the sandbox never sees the key
openshell sandbox create --name shop --from <your-registry>/ddd-agent:node24 \
  --cpu 4 --memory 8Gi --env VITEST_MAX_WORKERS=2

# npm reaches the registry through node, git reaches its host through git-remote-https
openshell policy update shop --rule-name npm_registry --binary /usr/local/bin/node \
  --add-endpoint registry.npmjs.org:443:read-only:rest:enforce --wait
openshell policy update shop --rule-name git_host --binary /usr/lib/git-core/git-remote-https \
  --add-endpoint github.com:443:read-write:rest:enforce --wait

openshell sandbox exec -n shop -- git clone https://github.com/<you>/shop shop
openshell sandbox exec -n shop -- sh -c 'cd shop && npm ci && npx --no -- lefthook install'
openshell sandbox connect shop   # then `cd shop && claude`
```

Une politique peut aussi s'écrire une fois dans un fichier (`--policy ./policy.yaml` à la
création, ou intégrée à l'image en `/etc/openshell/policy.yaml`) : ses sections sont
`filesystem_policy`, `landlock` (`compatibility: hard_requirement` refuse de démarrer sans lui),
`process` et `network_policies`, décrites dans le
[schéma des politiques](https://docs.nvidia.com/openshell/latest/how-it-works/policies/schema).
`openshell policy get shop --full` affiche celle en vigueur, un bon point de départ pour ce
fichier.

`VITEST_MAX_WORKERS` compte dans un conteneur : Node compte les cœurs de l'hôte, pas le `--cpu`
du bac à sable, et leur moitié peut faire plus de *workers* que le plafond n'en fait bien
tourner. Installez le *plugin* dans l'agent du bac à sable comme sur l'hôte
([Le plugin pour agents de code](coding-agents.fr.md)) ; la session travaille ensuite comme
sur l'hôte : une *story* ou un *worker* dans son *worktree* de `.worktrees/`, la garde, les
*hooks* et la barrière de qualité inchangés. Un *push* demande un identifiant pour l'hôte git :
rattachez un *provider* quand votre version en a un pour lui, ou gardez le bac à sable sans et
sortez les *commits* (`git bundle create`, puis `openshell sandbox download`) pour pousser depuis
l'hôte. Pour le [travail en parallèle](parallel-work.fr.md), un bac à sable par *worker* donne à
chacun son propre plafond.

`openshell logs shop --source sandbox --level warn` montre les requêtes que la politique a
refusées : n'y autorisez un hôte que quand le travail en a besoin.

## Lequel choisir

- La machine bloque ou redémarre, le code est le vôtre : le niveau 1, le *hook* de *pre-push* et
  la configuration du lanceur de tests du kit.
- Un agent travaille sans surveillance, ou sur du code ou des *prompts* que vous n'avez pas
  écrits (un ticket, une dépendance, une *pull request* venue de l'extérieur) : OpenShell, avec
  son `--cpu` et son `--memory`.
- Entre les deux : le niveau 2 avec le niveau 1 ; dans une organisation réglementée, le niveau 2
  tel que `init --agent-profile regulated` l'écrit, avec ses réglages gérés.

## Sources

- [Documentation de NVIDIA OpenShell](https://docs.nvidia.com/openshell/) : matrice de support,
  bacs à sable, politiques et leur schéma, lue le 2026-10-19 (version 0.1.4).
- [NVIDIA OpenShell sur GitHub](https://github.com/NVIDIA/OpenShell).
- [Claude Code : configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing),
  [settings](https://code.claude.com/docs/en/settings),
  [permissions](https://code.claude.com/docs/en/permissions),
  [managed settings](https://code.claude.com/docs/en/managed-settings),
  [hooks](https://code.claude.com/docs/en/hooks), lus le 2026-10-23 ; la page sandboxing et la
  [settings reference](https://code.claude.com/docs/en/settings-reference) de nouveau le
  2026-10-27, pour les listes du système de fichiers et le bac à sable exigé par l'administrateur.
- Anthropic, *AI-Native SDLC Playbook*
  ([PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)) :
  l'exemple d'une organisation réglementée que suit le profil.

## Voir aussi

- [Travail en parallèle](parallel-work.fr.md) : *workers*, *worktrees* et vagues.
- [Le plugin pour agents de code](coding-agents.fr.md) : ce que la garde vérifie, et ce
  qu'elle ne vérifie pas.
- [Socle de qualité](../tools/quality-baseline.fr.md) : ce qui tourne avant un *commit*, avant un
  *push* et dans le *pipeline*.
