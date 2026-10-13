[English](0001-combine-token-roles-with-relationships-in-one-authorizer.md) · **Français**
<!-- translation-of: 0001-combine-token-roles-with-relationships-in-one-authorizer.md sha256:72d97db5695c780e -->

# ADR-0001 : combiner les rôles du jeton et les relations dans un seul autorisateur

- Statut : accepté
- Date : 2026-10-10

## Contexte

La plupart des droits de cette application portent sur un élément : qui gère un cabinet, qui détient un poste ou en a reçu la délégation, à qui est ce rendez-vous. Ils changent avec les données ; ce sont donc des relations (le modèle `rebac` que le kit prend en charge), stockées sous forme de tuples et écrites dans l'unité de travail du changement qu'elles décrivent (`authorization.relation_tuples`).

Quelques droits ne portent sur aucun élément : un administrateur de la plateforme ouvre un cabinet ou lit le journal d'audit, n'importe quel utilisateur connecté s'inscrit comme personne ou parcourt les calendriers, un patient réserve pour lui-même sur un calendrier avec lequel il n'a aucune relation. Le fournisseur d'identité énonce déjà ces faits sous forme de rôles du realm dans le jeton. Le kit offre un seul port `Authorizer` par application et un seul modèle derrière lui ; il faut donc combiner les deux sources quelque part. C'est un choix parmi les options prises en charge (un adaptateur du port `Authorizer` écrit dans la plateforme), pas une dérogation à la référence de l'architecture.

L'application agit aussi pour son propre compte : les *jobs* planifiés et les gestionnaires d'événements d'intégration envoient des commandes protégées en tant qu'acteurs système.

## Décision

La plateforme lie un seul autorisateur, `RolesAndRelationshipsAuthorizer`, qui répond dans cet ordre :

1. l'acteur anonyme est refusé ;
2. un acteur système nommé `<context>.<what it does>` peut utiliser les permissions de ce contexte sur la ressource `context:<context>`, sans tuple stocké ;
3. un rôle du jeton peut accorder la permission, d'après la table `src/platform/auth/role-grants.ts` ; un octroi peut dépendre d'un fait que le cas d'usage énonce dans le `context` de son exigence (`selfService: true` pour un patient qui réserve pour lui-même) ; un acteur système ne détient jamais de rôle ;
4. sinon, les relations décident, par `RelationBasedAuthorizer` sur le schéma de `relationship-schema.ts` et la correspondance de `resource-permissions.ts`.

Pour une liste, seul un octroi marqué `listing: 'all'` et sans condition répond `{ kind: 'all' }` (l'administrateur de la plateforme). Tout autre octroi n'ouvre que le cas d'usage : les relations répondent quels éléments.

## Conséquences

- Plus simple : un droit sur aucun élément coûte une ligne d'une table qui se lit d'un coup d'œil, et ne demande d'écrire aucun tuple quand un utilisateur apparaît ou qu'un rôle change dans le fournisseur d'identité. Les gestionnaires d'événements d'intégration n'ont besoin d'aucune ligne dans `relate-system-actors.ts` ; les lignes générées des *jobs* restent et sont inoffensives.
- Plus difficile : il y a deux endroits où chercher la raison d'une décision. Les codes de refus disent lequel a répondu : `NO_MATCHING_ROLE` quand seul un rôle aurait pu accorder, `NO_RELATION`, `RESOURCE_REQUIRED` ou `UNMAPPED_PERMISSION` venant des relations.
- À surveiller : la table des rôles doit rester courte. Un droit qui dépend d'un élément appartient au schéma, jamais à un rôle. Un octroi par rôle est aussi frais que le jeton : retirer un rôle prend effet quand le jeton expire, alors que supprimer un tuple est immédiat.
- À surveiller : la table des rôles et la correspondance nomment les permissions par identifiant. Un identifiant qu'aucun contexte ne déclare n'est jamais demandé et n'accorde rien ; une permission renommée échoue donc en position fermée, en silence. Une *spec* qui compare ces identifiants au registre des permissions vaudra la peine d'être ajoutée une fois les contextes stables.
- À surveiller : la règle 2 fait confiance au nom d'un acteur système. Ce nom n'est jamais donné que par le code d'un contexte (`systemActor(...)`) ; aucun authentificateur ne produit d'acteur de type `system`. Elle tient tant que cela reste vrai.
- L'emprunt d'identité (impersonation) est orthogonal : le jeton de l'utilisateur dont on prend l'identité porte ses rôles et ses relations, et le bus de commandes refuse toute commande d'une telle session (`IMPERSONATION_READ_ONLY`).

## Alternatives envisagées

- **Un seul autorisateur sur les deux sources (retenue).** Un adaptateur du port `Authorizer` dans la plateforme : pris en charge par le kit, aucun changement dans les contextes.
- **Les rôles comme tuples.** Un objet `platform` avec une relation `admin`, écrite quand un rôle est donné. Un seul modèle et un seul endroit où chercher, mais le fournisseur d'identité reste la source des rôles : les tuples seraient une copie à garder synchronisée (un écouteur sur ses événements, ou une écriture à chaque connexion), et une synchronisation manquée accorderait ou refuserait à tort. L'octroi conditionnel d'un patient n'a pas d'équivalent : le kit n'implémente aucune condition (caveat) sur un tuple.
- **Des politiques seulement.** Des politiques à base d'attributs évaluées par `Access` sur l'élément chargé. Elles ne peuvent pas répondre à une liste sans charger chaque élément, elles mettent la délégation et l'adhésion dans le code de chaque contexte alors que le schéma les énonce une fois, et il leur faudrait encore les rôles à côté.
- **Un tuple par acteur système.** L'approche générée : une ligne dans `relate-system-actors.ts` pour chaque *job* et chaque gestionnaire. Gardée pour les *jobs*, que le générateur écrit ; abandonnée pour les gestionnaires, où une ligne oubliée ne se voit que par un consommateur qui échoue à l'exécution.
