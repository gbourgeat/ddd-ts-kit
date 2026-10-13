[English](context-presets.md) · **Français**
<!-- translation-of: context-presets.md sha256:6593b5d1cd19a49e -->

# Proposition : quels contextes méritent un *preset*

Cette page pèse quels contextes délimités, en plus d'`identity`, le kit devrait écrire en entier
avec `--preset`, et dit pourquoi les autres ne le devraient pas. Aucun n'est construit : le
*preset* `identity` est le seul
([Démarrer avec des contextes bien conçus](../guides/bootstrap-with-well-designed-contexts.fr.md)).

## État (2026-10-13)

| Contexte | Verdict | En une ligne |
|---|---|---|
| Identité | **construit** | les comptes venus du fournisseur d'identité, les organisations, les membres, les invitations, les délégations |
| Notification | **le prochain** | le langage est stable et chaque application le réécrit ; l'exemple en a déjà un dont apprendre |
| Fichiers | **non, depuis la 0.9.0** | une capacité de la plateforme : le port `FileStorage`, ses connecteurs, `init --storage`, `generate file-upload` |
| Demandes sur les données personnelles | **un guide, pas un *preset*** | elles traversent chaque contexte ; un contexte à part le cacherait |
| Audit | **non** | une capacité de la plateforme (`@ddd-ts-kit/audit`, `--audit on`), pas un contexte |
| Facturation, abonnements | **non** | les prix, les offres et les factures sont là où les métiers diffèrent |
| Réglages, *feature flags* | **non** | un outil y répond (OpenFeature et un fournisseur) ; aucun domaine à modéliser |

## Ce qui fait qu'un contexte vaut un *preset*

Un *preset* vaut d'être écrit quand tout ceci est vrai :

1. **Générique.** Classé `generic` dans la plupart des projets qui l'ont
   ([Domaine et sous-domaines](../concepts/domain-and-subdomains.fr.md)) : nécessaire, et aucun
   métier ne gagne avec un meilleur.
2. **Un seul langage.** Ses termes veulent dire la même chose d'un projet à l'autre, si bien
   qu'un glossaire peut s'écrire une fois. L'identité y satisfait (compte, organisation, membre,
   invitation) ; « commande » non.
3. **Des erreurs qu'il évite.** Il porte des décisions qu'une équipe prend mal tôt : une table de
   mots de passe, un identifiant de *tenant* lu dans la requête HTTP, un jeton gardé en clair, une
   notification envoyée avant la validation (commit).
4. **Peu de décisions de *stack*.** Ce dont il a besoin de la *stack* est déjà un choix
   d'`init` ; un *preset* qui a besoin d'un nouveau genre d'adaptateur a d'abord besoin de cet
   adaptateur.
5. **Assez petit pour se l'approprier.** Une équipe le lit en une heure et le change comme son
   propre code. Un *preset* est écrit une fois et jamais mis à jour dans le projet par le kit.

## Notification : le prochain

Ce qu'il contiendrait : un contact par compte (adresses par canal, préférences, heures de
silence) ; un message demandé par un événement d'intégration d'un autre contexte, rendu depuis
un *template* et envoyé après la validation par un port par canal (courriel, SMS, *push*) avec un
*fake* en mémoire ; les tentatives de remise avec leur issue, des nouvelles tentatives bornées par
les politiques de résilience du kit ; un désabonnement qui l'emporte sur toute demande ; une
recherche des messages d'un contact.

Pourquoi le prochain : les critères 1 à 3 tiennent dans presque toute application, et le propre
contexte `notification` de l'exemple prouve déjà la forme sur Knex (des contacts, une recherche,
des consommateurs des événements de `scheduling`). Ce qu'il coûte : au moins un adaptateur de
courriel (SMTP par un petit client, ou une recette documentée pour l'API HTTP d'un fournisseur),
et des *templates*, pour lesquels le kit n'a pas encore de convention ; une première version peut
prendre les *templates* comme du code.

## Fichiers : une capacité de la plateforme

Ce qu'un *preset* aurait contenu (un téléversement préparé avant la transaction, un
enregistrement de fichier avec sa clé, sa taille, son type et sa somme de contrôle, une analyse
avant qu'un fichier ne soit accepté, la suppression avec l'élément auquel il appartient) est ce
que le kit donne à chaque contexte depuis la 0.9.0 : le port `FileStorage` et ses connecteurs
(mémoire, répertoire local, compatible S3), `init --storage`, et
`generate file-upload <context> <UseCase>` pour le cas d'usage qui reçoit un fichier
([Stockage de fichiers](../concepts/file-storage.fr.md)). Un fichier appartient à l'agrégat qui
le référence, dans son propre contexte ; un contexte de fichiers lui retirerait cette référence.
Ce qui pourrait encore mériter un *preset* est une bibliothèque de documents, où les documents
sont le métier (dossiers, versions, partage) : elle échouerait au critère 2 dans la plupart des
projets, donc pas maintenant.

## Demandes sur les données personnelles : un guide

Les demandes d'export et d'effacement touchent chaque contexte qui garde des données
personnelles, chacun dans ses propres tables et avec ses propres mots. Un contexte qui y
répondrait seul devrait lire les tables de tout le monde, ou chaque contexte lui publierait ses
données : les deux brisent les frontières que le kit fait respecter. La meilleure forme est une
convention : chaque contexte déclare les données qu'il garde sur une personne et répond lui-même
à un événement d'intégration `person.erasure-requested` ; le journal d'audit enregistre l'issue.
Un guide, avec un générateur pour le gestionnaire, convient ; un *preset* non.

## Audit, facturation, réglages : non

- **L'audit** est déjà écrit par la plateforme autour de chaque cas d'usage, avec ses propres
  tables et sa recherche ([Journal d'audit](../concepts/audit-trail.fr.md)). Un contexte le
  dupliquerait.
- **La facturation et les abonnements** échouent au critère 2 : les offres, le prorata, les taxes
  et les factures diffèrent selon le métier et le pays, et le fournisseur de paiement décide
  d'une grande partie du modèle. Le kit peut aider avec une *gateway* vers un fournisseur
  (`generate gateway`), pas avec un modèle.
- **Les réglages et les *feature flags*** échouent autrement au critère 1 : il n'y a rien à
  modéliser, et un outil (OpenFeature avec un fournisseur) le fait mieux qu'un contexte.

## Non décidé

- Si un *preset* devrait pouvoir viser un contexte existant pour en ajouter une partie (les
  invitations seules, par exemple). Aujourd'hui un *preset* écrit un contexte entier, et un
  fichier déjà présent est gardé.
- Si les *presets* devraient vivre hors du *package* de la CLI, pour qu'une équipe puisse publier
  les siens. L'interface `Preset` de `packages/cli/src/presets/preset.ts` le permettrait ; les
  *templates* et leurs variantes par *stack* en sont le coût.
