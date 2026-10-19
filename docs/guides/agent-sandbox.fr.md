[English](agent-sandbox.md) · **Français**
<!-- translation-of: agent-sandbox.md sha256:ba6b544a5a15d269 -->

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
| les *workers* du lanceur de tests | à chaque exécution | hors *pipeline* (pas de variable `CI`), Vitest et Jest prennent la moitié des cœurs (`maxWorkers: '50%'` dans la configuration générée) ; `VITEST_MAX_WORKERS=2`, ou `--maxWorkers=2` pour Jest, fixe le nombre |
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
- Entre les deux : le niveau 2 avec le niveau 1.

## Sources

- [Documentation de NVIDIA OpenShell](https://docs.nvidia.com/openshell/) : matrice de support,
  bacs à sable, politiques et leur schéma, lue le 2026-10-19 (version 0.1.4).
- [NVIDIA OpenShell sur GitHub](https://github.com/NVIDIA/OpenShell).
- [Claude Code : configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing).

## Voir aussi

- [Travail en parallèle](parallel-work.fr.md) : *workers*, *worktrees* et vagues.
- [Le plugin pour agents de code](coding-agents.fr.md) : ce que la garde vérifie, et ce
  qu'elle ne vérifie pas.
- [Socle de qualité](../tools/quality-baseline.fr.md) : ce qui tourne avant un *commit*, avant un
  *push* et dans le *pipeline*.
