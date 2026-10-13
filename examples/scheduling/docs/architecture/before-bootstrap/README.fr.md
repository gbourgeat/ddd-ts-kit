[English](README.md) · **Français**
<!-- translation-of: README.md sha256:87c761d835f3d29f -->

# Artefacts consommés par l'amorçage

La méthode écrit le glossaire et l'ébauche de la carte des contextes avant que le projet existe,
puis les transforme en arguments de `generate context` et les supprime : leur contenu vit ensuite
dans chaque `CONTEXT.md`, dans `ddd-ts-kit.config.json` et dans `docs/context-map.md`, et une
seconde copie divergerait. Ils sont gardés ici, figés, pour une seule raison : ce projet est un
exemple, et un lecteur doit pouvoir rejouer le chemin depuis `../needs.md`. Ne les mettez pas à jour.
