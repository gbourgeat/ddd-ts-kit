[English](agent-sandbox.md) · **Français**
<!-- translation-of: agent-sandbox.md sha256:d9bf1081aa4aa41d -->

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
projet dont les réglages manquent d'une ligne du bloc (`--strict` échoue dessus). Ce que chaque
ligne apporte, en termes de contrôle :

| Ligne | Où | Ce qu'elle apporte |
|---|---|---|
| `sandbox.enabled: true` | `.claude/settings.json` | chaque commande *shell* de l'agent tourne dans le bac à sable (bubblewrap et socat sous Linux) : elle écrit où le bac à sable l'autorise et joint le réseau par son *proxy* |
| `sandbox.failIfUnavailable: true` | projet | sur une machine sans bac à sable, la session s'arrête au démarrage au lieu de lancer les commandes hors bac à sable : aucune dégradation silencieuse |
| `sandbox.allowUnsandboxedCommands: false` | projet | l'agent ne peut pas lancer une commande hors du bac à sable (la demande `dangerouslyDisableSandbox` est ignorée) : aucune nouvelle tentative en contournant le contrôle |
| `sandbox.network.allowedDomains: ["registry.npmjs.org", "<hôte git>"]` | projet | une commande joint le registre des paquets et l'hôte git du projet (lu dans `repository` de `package.json`, sinon dans le *remote* `origin` ; ajoutez votre miroir si vous en tenez un) et rien d'autre : aucune exfiltration par `curl`, aucun paquet d'un hôte inconnu |
| `sandbox.credentials.files` : `~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.azure` refusés | projet | une commande ne peut pas lire les clés du développeur : une injection de *prompt* ne peut pas les envoyer |
| `sandbox.credentials.envVars` : `GITHUB_TOKEN`, `GH_TOKEN`, `GITLAB_TOKEN`, `NPM_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_CLIENT_SECRET` refusées | projet | les variables sont retirées avant chaque commande en bac à sable : un jeton dans le *shell* du développeur n'est pas dans celui de l'agent |
| `permissions.deny: Read(./.env)`, `Read(./.env.local)`, `Read(./.env.*.local)`, `Read(./.env.production)`, `Read(./.env.development)`, `Read(./.env.test)` | projet, écrit aussi sans le profil | les secrets du projet restent hors du contexte de l'agent : le bac à sable ne couvre que les commandes *shell*, pas l'outil Read, donc une règle de permission tient celui-ci |
| `allowManagedPermissionRulesOnly: true` | réglages gérés | les règles de permission de l'organisation sont les seules : un fichier de projet ou d'utilisateur ne peut pas les élargir |
| `permissions.disableBypassPermissionsMode: "disable"` | gérés | le mode qui saute chaque demande de permission est refusé : aucune session ne tourne sans les portes |
| `allowManagedHooksOnly: true` | gérés | seuls les *hooks* de l'organisation tournent ; copiez-y les *hooks* du profil, sinon un fichier de projet ne peut pas les garder. Un projet ne peut pas retirer la porte de production |
| `strictKnownMarketplaces: [{ "source": "github", "repo": "gbourgeat/ddd-ts-kit" }]` | gérés | les *plugins* viennent des *marketplaces* que l'organisation nomme (celle du kit, ou votre miroir) : aucun *skill* non relu |
| `requiredMinimumVersion: "<version>"` | gérés | un Claude Code plus ancien que la version nommée ne démarre pas : chaque session a les contrôles de cette version |
| `hooks.PreToolUse` : `production-gate.mjs` sur `Bash` | projet, `.claude/hooks/` | une commande qui nomme l'environnement de production avec une action de mise en production ne tourne pas sans approbation nommée : l'autorisation de mise en production du processus de changement, tenue au moment où la commande tournerait |
| `hooks.PreToolUse` : `change-reference.mjs` sur `Edit\|Write` | projet, `.claude/hooks/` | une modification d'une migration ou des conteneurs est confirmée par une personne avec une référence de changement en tête, enregistrée comme *trailer* `Change:` du *commit* : le ticket de changement du processus, sur ce qui atteint la production autrement que par le code |

Les réglages gérés vivent hors du dépôt (`managed-settings.json`, déployé par l'équipe
plateforme) : `init` les affiche comme un bloc à coller, la version laissée à l'équipe. Associez
le profil au niveau 1 pour la charge de la machine.

Les deux *hooks* sont de petits scripts Node qu'`init` écrit une fois sous `.claude/hooks/` (pas
de `jq`, rien à installer), enregistrés sous `hooks.PreToolUse` de `.claude/settings.json`,
possédés par l'équipe dès lors, et signalés par `doctor` quand un fichier ou un enregistrement
manque. Chacun s'explique à l'agent :

- `production-gate.mjs` tourne avant chaque commande `Bash`. Une commande qui nomme
  l'environnement de production du projet (les mots de `PRODUCTION_ENVIRONMENTS` en tête du
  fichier, `production` par défaut) avec une action de mise en production (`RELEASE_ACTIONS` :
  `deploy`, `migrate`, `rollback`) est bloquée, code de sortie 2, avec la raison que l'agent lit :
  la commande ne tourne qu'une fois qu'une personne a approuvé la mise en production, d'après la
  liste de contrôle de l'équipe, en posant `RELEASE_APPROVAL="<approbateur> <id du changement>"`
  dans l'environnement de la session ; le *hook* la laisse alors passer et dit qui a approuvé
  quoi. L'agent est prévenu de ne pas poser la variable lui-même. Les listes se modifient dans le
  fichier, ou s'étendent pour une session par les variables `PRODUCTION_GATE_ENVIRONMENTS` et
  `PRODUCTION_GATE_ACTIONS` (séparées par des virgules). Toute autre commande passe telle quelle.
- `change-reference.mjs` tourne avant chaque `Edit` et `Write`. Un fichier sous `migrations/` ou
  `prisma/migrations/`, sous `docker/`, le `Dockerfile` ou `docker-compose.yml` fait répondre au
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

Les noms et les formes des clés ci-dessus ont été vérifiés le 2026-10-23 dans la documentation de
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

#### Les contrats générés sous le bac à sable

`init` écrit des règles de refus pour les contrats que le kit génère (`Edit(./openapi/**)`,
`Edit(./docs/integration/asyncapi.*)`, `Edit(./docs/integration/event-catalog.md)`,
`Edit(./test/acceptance/*.acceptance.lock.json)`), pour que l'outil Edit n'en modifie jamais un à
la main. Le bac à sable de Claude Code transforme une règle de refus sur `Edit` en montage en
lecture seule du chemin, y compris pour les commandes du shell. Les règles restent, et voici la
conséquence : dans une session sous le bac à sable, une commande qui écrit l'un de ces fichiers
échoue, quelle que soit la commande.

- **La fusion d'une branche qui a régénéré les contrats** (`git merge --no-ff work/wave1` dans le
  dépôt principal) s'arrête à mi-chemin, après avoir écrit des copies non suivies des nouveaux
  fichiers de la branche. Il en va de même de `npm run docs:generate` dans le dépôt principal.
- **Que faire** : jouer ces deux gestes hors du bac à sable, depuis un terminal à vous (fusionner
  la branche, puis lancer `docs:generate` et valider ce qu'il a changé), ou démarrer la session
  avec `claude --setting-sources local`, qui ne lit pas les réglages du projet, règles de refus et
  bloc `sandbox` compris : cela ne vaut que pour une session que vous décidez de lancer ainsi,
  puisque cela retire aussi les autres contrôles du fichier du projet. Dans les deux cas, la
  garde du plugin refuse toujours la modification à la main d'un fichier généré, et
  `docs:generate` reste le seul auteur de ces contrats.
- Après une fusion hors du bac à sable, lancez `npm run docs:generate` et vérifiez que rien ne
  change : un contrat régénéré par la fusion doit être égal à celui que la branche porte.

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
  [hooks](https://code.claude.com/docs/en/hooks), lus le 2026-10-23.
- Anthropic, *AI-Native SDLC Playbook*
  ([PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)) :
  l'exemple d'une organisation réglementée que suit le profil.

## Voir aussi

- [Travail en parallèle](parallel-work.fr.md) : *workers*, *worktrees* et vagues.
- [Le plugin pour agents de code](coding-agents.fr.md) : ce que la garde vérifie, et ce
  qu'elle ne vérifie pas.
- [Socle de qualité](../tools/quality-baseline.fr.md) : ce qui tourne avant un *commit*, avant un
  *push* et dans le *pipeline*.
