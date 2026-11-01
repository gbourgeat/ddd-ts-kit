[English](0006-the-regulated-guard-runs-git-in-its-root-only.md) · **Français**
<!-- translation-of: 0006-the-regulated-guard-runs-git-in-its-root-only.md sha256:7dff4c960c668a90 -->

# ADR-0006 : la garde réglementée ne lance git qu'à sa racine

## Décision

Sous [le profil réglementé](../guides/agent-sandbox.fr.md#le-profil-réglementé), la garde du *plugin* lance git dans un seul dépôt : le dépôt de la racine de la session. La racine de la session est le dossier où Claude Code a démarré la session, qu'il donne à ses *hooks* dans `CLAUDE_PROJECT_DIR`, ou à défaut le répertoire de travail qu'envoie l'hôte. La garde trouve ce dépôt avec `git rev-parse --show-toplevel`, lancé depuis la racine. Une copie de travail en fait partie quand ses fichiers git mènent au même répertoire git commun : un *worktree* lié sous `.worktrees/` en fait donc partie. Un dépôt imbriqué, un sous-module et un *worktree* d'un autre dépôt ont chacun leur propre répertoire commun. La garde n'y lance aucun git, à aucun *hook*, et le début de session comme l'arrêt disent que le projet qui s'y trouve n'est pas lu. Dans le dépôt de la racine, `git status` et `git diff` tournent avec `--ignore-submodules=all`, pour que git ne se relance pas dans chaque sous-module. Chaque git que lance la garde, ceux des passes d'un *builder* compris, garde `-c core.fsmonitor=false`, `-c core.hooksPath=/dev/null` et `--no-optional-locks`.

Le profil compte quand la racine de la session ou l'endroit le déclare. Sous le profil par défaut, la garde lance git là où elle le lançait avant, dans le dépôt que trouve chaque *hook*.

## Pourquoi

Les *hooks* tournent hors du bac à sable, et git suit la configuration du dépôt où il tourne, où un filtre ou un pilote de diff nomme un programme. Le bac à sable de Claude Code empêche ses commandes d'écrire `.git/config` et `.git/hooks` dans le répertoire de travail de la session, et dans le répertoire git partagé de ses *worktrees* ([Protected paths](https://code.claude.com/docs/en/sandboxing), lu le 2026-11-01). Il ne protège la configuration d'aucun autre dépôt, ni celle d'un sous-module, gardée sous `.git/modules/`, et git lit les fichiers de chaque sous-module quand il compare ceux du super-projet. La configuration du dépôt de la racine de la session est donc celle à laquelle la garde peut se fier, et elle ne lance git que là.

Git n'a aucune option qui éteigne tous les filtres et tous les pilotes de diff. `-c filter.<nom>.clean=` vide un pilote dont on connaît le nom à l'avance. `--attr-source` change l'endroit où les attributs sont lus, pas les pilotes que définit la configuration. `--no-ext-diff` et `--no-textconv` laissent le filtre `clean` en place. Lire la configuration pour vider chaque pilote qu'elle nomme poursuivrait chaque sorte de pilote que git a ou ajoute (`clean`, `smudge`, `process`, `textconv`, `command`), et un nom que `-c` ne sait pas écrire, un nom qui contient `=`, tournerait quand même. La garde s'en tient donc à une règle qu'elle peut tenir : le dépôt de la racine, dont elle se fie à la configuration parce que le bac à sable la protège, et aucun autre.

## Ce que cela coûte

- Dans un projet hors du dépôt de la racine de la session, la garde ne lit rien par git : aucun rappel de la taille d'un *commit*, aucune comparaison de ce qu'a changé la commande d'un *worker*, aucune branche d'un *worker* lue. Le début de session et l'arrêt le disent.
- Un changement dans un sous-module échappe à la garde : elle ne compare que les fichiers de la racine.
- La règle tient autant que le bac à sable protège la racine. Claude Code ne protège `.git/config` et `.git/hooks` que dans le répertoire de travail. Une session démarrée dans un sous-dossier d'un dépôt laisse la configuration du haut de ce dépôt à portée d'une commande du bac à sable. Sous Codex et Copilot, la garde ne connaît aucun fichier qui allume leur bac à sable : elle ne peut pas dire si la configuration de la racine y est hors de portée d'une commande.
- La garde se fie à la configuration globale du développeur et à celle qu'inclut le dépôt de la racine (`include.path`), comme git.
- Un *worktree* du dépôt de la racine avec `extensions.worktreeConfig` lit un `config.worktree` sous `.git/worktrees/`, que le bac à sable ne protège pas. Seul un développeur pose cette extension, dans la configuration protégée.

## Ce qui la renverserait

Une option de git qui ne lance aucun programme que nomme la configuration, pour des lectures comme `status` et `diff`. La garde lancerait alors git dans chaque dépôt avec cette option, dépôts imbriqués et sous-modules compris. Un hôte qui protégerait la configuration de chaque dépôt sous son répertoire de travail la renverserait aussi.
