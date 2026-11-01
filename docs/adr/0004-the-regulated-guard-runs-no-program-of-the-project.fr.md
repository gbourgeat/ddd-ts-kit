[English](0004-the-regulated-guard-runs-no-program-of-the-project.md) · **Français**
<!-- translation-of: 0004-the-regulated-guard-runs-no-program-of-the-project.md sha256:1db0309550862bbc -->

# ADR-0004 : la garde du profil régulé n'exécute aucun programme du projet

## Décision

Sous le profil régulé, la garde du *plugin* (`plugin/hooks/guard.mjs`) ne démarre, à aucun *hook*, le `ddd-ts-kit` ni le Biome de `node_modules`. Les règles que la garde lit elle-même continuent de tourner : un fichier généré, la portée d'un *worker*, le verrou d'un correctif, la taille d'un commit. L'entrée du changement est `changes/the-regulated-guard-runs-no-program-of-the-project.md`.

Le profil est lu par `isRegulated`, à la racine du projet et dans chaque dossier au-dessus, depuis :

- `agents.profile` fixé à `regulated` dans `ddd-ts-kit.config.json` ;
- `.claude/settings.json` aux mêmes niveaux, où `sandbox.enabled: true` avec `sandbox.allowUnsandboxedCommands: false` compte pour le profil.

Le *sandbox* de Claude Code refuse à ses commandes l'écriture de `.claude/settings.json` dans leur dossier de travail et au-dessus, donc une commande qui réécrit la configuration, ou en laisse une autre plus bas, ne ramène pas ces exécutions. Aucune ligne `denyWrite` ne protège `ddd-ts-kit.config.json` lui-même : `generate context`, `sdk` et les préréglages l'écrivent depuis l'intérieur du *sandbox*, ce qui a été mesuré. Une telle ligne empêcherait la CLI de faire son travail.

## Pourquoi

Les *hooks* tournent hors du *sandbox*, et une commande du *sandbox* peut écrire le projet. Un programme que démarre un *hook* depuis `node_modules` a donc les droits du développeur, pas ceux du *sandbox*. Sous le profil qui existe pour garder l'agent dans ses limites, la garde s'en tient à ce qu'elle lit elle-même et ne démarre rien de ce que le projet contient. L'organisation régulée peut dire en une phrase ce que la garde exécute : son propre fichier.

## Ce que cela coûte

Aucune vérification à l'écriture ni à l'arrêt sous ce profil. `check-file` après une écriture ne tourne pas, avec `formatOnWrite` et `dependenciesBeforeWrite`. `check` ne tourne pas à la fin d'un tour, donc un tour n'est plus refusé pour des erreurs d'architecture. La porte de build et la prochaine étape d'une histoire, la carte des contextes et les *workers* à reprendre ne sont pas répondus.

Ce qui tient à la place : le début de session le dit en une ligne, un arrêt ne bloque pas sur une vérification qui n'a pas tourné et ne dit pas qu'elle a tourné, `doctor` rapporte ce qu'il a fait, un agent lance `npx ddd-ts-kit check` dans le *sandbox*, et le pipeline et la porte de commit tiennent ces vérifications. Un projet qui comptait sur `formatOnWrite` formate au commit.

Sur Codex et Copilot aucun `.claude/settings.json` n'existe, donc `agents.profile` y est le seul signe.

## Ce qui l'inverserait

Une CLI que la garde peut vérifier avant de l'exécuter (une empreinte épinglée que le profil énonce, tenue hors du projet), ou un *runtime* de *hooks* qui démarre les commandes dans le *sandbox*, ramènerait les vérifications à l'écriture et à l'arrêt. Voir [Sandboxer les agents de code](../guides/agent-sandbox.fr.md).
