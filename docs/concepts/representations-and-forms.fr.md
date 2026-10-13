[English](representations-and-forms.md) · **Français**
<!-- translation-of: representations-and-forms.md sha256:06bd3607b6ea8710 -->

# Représentations, accès aux champs et formulaires décrits par le serveur

**Résumé.** Une route répond une valeur typée que vérifie son schéma de réponse ; la façon dont
cette valeur devient des octets est une préoccupation de présentation à part entière. Le même
agenda est voulu en JSON par l'application web, en XML par un partenaire et en CSV par un
tableur ; le même corps de réservation est rempli par un patient, par un assistant et par un
praticien, qui ne peuvent pas voir ni poser les mêmes champs. Cette page explique les trois idées
sur lesquelles le kit s'appuie : un seul schéma, plusieurs représentations choisies par
négociation de contenu ; les champs d'un schéma réservés à certains appelants, décidés par la
même autorisation que les cas d'usage ; et des formulaires décrits par le serveur à partir de ce
qu'une route déclare déjà. Le mode d'emploi est dans le
[README de `@ddd-ts-kit/http`](../../packages/http/README.fr.md) ; les bibliothèques et les moteurs
de rendu sont comparés dans [tools/representations-and-forms.fr.md](../tools/representations-and-forms.fr.md).

## Une valeur, plusieurs représentations

Le schéma d'une réponse est le contrat : le serveur vérifie ce qu'il répond par rapport à lui, et
le document OpenAPI en est généré. Une représentation est une fonction de cette valeur et de ce
schéma, rien d'autre :

![Un gestionnaire répond une valeur typée ; le schéma de réponse la vérifie ; l'accès aux champs écarte ce que l'appelant ne peut pas lire ; la négociation sur Accept choisit JSON, XML ou CSV parmi ce que produit la route, ou refuse par un 406 quand aucun n'est en commun](../assets/diagrams/representations-and-forms-one-value.fr.svg)

Quatre conséquences :

- **Pas de second modèle.** Il n'y a pas de « DTO XML » à côté du DTO JSON : les noms d'éléments
  et les attributs viennent du schéma (l'objet XML d'OpenAPI), les colonnes d'un CSV des
  propriétés d'un élément. Un format de partenaire doté de son propre vocabulaire (espaces de
  noms, contenu mixte, un XML Schema que possède le partenaire) n'est pas une représentation :
  c'est une couche anticorruption avec son propre *mapper*.
- **La négociation est un contrat.** La route dit ce qu'elle produit ; la requête HTTP dit ce
  qu'elle accepte (RFC 9110) ; aucun en commun donne un `406`. Un corps envoyé en XML est lu en la
  valeur qu'aurait produite le chemin JSON et validé par le même schéma : un seul jeu de règles,
  quel que soit le format sur le fil. Un fichier n'est pas une représentation : une route qui
  répond par des octets ou par un flux à elle ne déclare aucun schéma de corps, et aucun en-tête
  `Accept` ne la refuse.
- **Une longue liste est lue à travers le bus, page par page.** Un export diffuse page après page,
  chaque page étant une requête envoyée par le bus, si bien que chacune est autorisée, exécutée
  dans sa transaction et sa session de *tenant*, chronométrée et tracée. Une requête qui
  répondrait une liste paresseuse serait lue après le retour du bus, en dehors de tout cela.
- **Les règles de sérialisation sont standard.** Un instant est en ISO 8601 UTC, un montant une
  chaîne décimale avec sa devise, un identifiant une chaîne, un vocabulaire fermé son code, une
  liste une enveloppe de page ou un flux. Un projet ne les décide pas de nouveau pour chaque
  format.

Les agrégats ne sont jamais sérialisés. Une représentation voit le type de présentation que
répond un contrôleur, qu'un sérialiseur a construit à partir d'un modèle de lecture.

## Champs réservés à certains appelants

« Le patient ne voit pas la note interne » est un droit, il relève donc de l'autorisation, pas
d'un `if (actor.roles.includes('practitioner'))` dans un sérialiseur : ce test est oublié dans
l'export CSV, dans le XML pour le partenaire et dans le formulaire, et aucun contrat ne dit que
le champ peut manquer.

Le kit marque plutôt le champ sur le schéma : un champ exige une permission ou une politique pour
être lu, et éventuellement une autre pour être posé. La permission est décidée par le même
`Access` qu'un cas d'usage, à propos de l'élément auquel appartient le champ (l'agenda du
rendez-vous), si bien que les rôles, les politiques par attributs et les relations fonctionnent
tous. Poser un champ est un acte, et sa décision est enregistrée comme toute autre ; montrer ou
cacher un champ ne fait que façonner une réponse, et n'est pas enregistré, si bien qu'une page de
mille lignes n'écrit pas mille lignes dans le journal d'audit.

| Où | Un champ que l'appelant ne peut pas lire | Un champ que l'appelant peut lire mais pas poser |
|---|---|---|
| Une réponse, dans chaque représentation | absent | présent |
| Un corps de requête HTTP | refusé, 403 | refusé, 403 |
| Un formulaire décrit par le serveur | absent | en lecture seule |
| Le contrat | marqué `x-field-access`, non exigé | la même chose |

Deux choses restent ailleurs. **Quelles lignes** un acteur peut lire est le périmètre d'accès de
la requête, appliqué dans l'instruction ; l'accès aux champs ne filtre jamais les lignes. **Ce
qu'un champ peut contenir** relève de la validation, et une règle métier à son sujet reste un
invariant du domaine. Le cas d'usage vérifie toujours lui-même la permission d'écriture
(`Access.authorize` dans le gestionnaire), parce qu'un *job* ou un autre transport envoie la même
commande sans passer par HTTP.

**Une réponse qui cache des champs diffère selon l'appelant**, même sur une route que tout le
monde peut appeler : un cache partagé qui aurait gardé la réponse d'un membre de l'équipe sous son
URL remettrait la note au prochain appelant anonyme. Une politique de cache `public` sur une telle
route est refusée quand les routes sont montées, à moins que son `vary` ne nomme `Authorization`
ou `Cookie` ; `private` est la réponse habituelle ([Cache HTTP](http-caching.fr.md)).

## Formulaires décrits par le serveur

Un front-end reconstruit d'habitude, pour chaque commande, un formulaire que le serveur décrit
déjà : les champs, leurs types, leurs longueurs, les valeurs d'un vocabulaire fermé. Le décrire à
partir de la route garde une seule source :

- **À partir de ce que la route déclare.** Le schéma de la requête HTTP donne les champs, leurs
  contraintes et leurs options ; quelques indications de présentation ajoutent ce qu'un schéma ne
  peut pas dire : les groupes et l'ordre, le *widget* d'un champ, la route d'où un champ tire ses
  options, quand un champ s'affiche ou est exigé. Les libellés sont des clés de traduction,
  jamais du texte.
- **Pour l'appelant.** Le formulaire n'est donné qu'à qui peut exécuter son cas d'usage, la
  permission étant demandée comme la commande la demande, à partir des valeurs de la requête
  HTTP (l'agenda dans `?calendarId=`, qui réserve pour qui) ; tout autre reçoit un 403 et n'apprend
  rien de ses champs. Les champs cachés et en lecture seule viennent ensuite du même accès aux
  champs que les réponses, à propos du même élément ; un objet que l'appelant ne peut pas poser
  est en lecture seule jusqu'à son dernier champ.
- **Deux formats issus d'un même arbre.** Un arbre neutre de groupes et de champs est le modèle
  du kit ; JSON Forms (un JSON Schema, un schéma d'interface et les données) en est produit, parce
  que des moteurs de rendu maintenus existent pour React, Angular et Vue.

Un formulaire porte la forme et la présentation, jamais une règle métier. « Un rendez-vous ne
peut pas en chevaucher un autre » reçoit sa réponse de la commande quand le formulaire est
envoyé ; le formulaire ne fait que prévenir tôt l'utilisateur de ce que le schéma refuserait de
toute façon. Et le serveur valide de nouveau : un formulaire est une commodité pour le client,
jamais une vérification.

![Le schéma du corps de la réservation réserve la note interne ; la route du formulaire demande la permission de réserver et interroge Access à propos de l'agenda ; le praticien titulaire du bureau peut poser chaque champ, un assistant sur un bureau délégué voit la note en lecture seule, un patient qui réserve pour lui-même ne la voit pas, et un assistant sans délégation est refusé par un 403](../assets/diagrams/representations-and-forms-one-form-per-caller.fr.svg)

## Limites

- Le XML rend ici le modèle JSON ; ce n'est pas un outil de conception de vocabulaires XML.
- CSV est écrit, jamais lu, et ne contient que des lignes plates : un import est un cas d'usage
  avec son propre schéma de corps.
- Une liste en flux ne peut plus être refusée une fois son premier élément écrit : un échec
  ultérieur coupe court la réponse, et il est signalé comme une faute.
- L'accès aux champs juge les champs du schéma sur lequel il est déclaré ; un objet imbriqué se
  restreint par son propre schéma. Un schéma partagé garde les marques, quel que soit celui des
  deux qui enveloppe l'autre (`sharedSchema(name, withFieldAccess(...))` ou
  `withFieldAccess(sharedSchema(...), ...)`) ; un schéma construit à partir d'un schéma marqué par
  un autre moyen (une partie qui en est prise, la composition propre d'une bibliothèque) est une
  nouvelle forme et se marque de nouveau. Chaque exigence est une décision par élément distinct
  de la réponse, retenue pour les quelques centaines de derniers éléments : un long export avec un
  élément par ligne coûte une décision par ligne.
- Un formulaire nomme la permission de son cas d'usage (`requires`) ; un formulaire qui ne le
  fait pas est donné à quiconque peut appeler sa route.
- Un formulaire décrit des scalaires, des objets imbriqués et des listes d'un vocabulaire fermé ;
  la mise en page au-delà des groupes et de l'ordre, et le comportement d'une consultation,
  reviennent au front-end.

## Voir aussi

- [La couche présentation](presentation-layer.fr.md) : contrôleurs, *mappers*, sérialiseurs,
  gardes.
- [Authentification et autorisation](authentication-and-authorization.fr.md) : les modèles par
  lesquels une exigence sur un champ est décidée.
- [Invariants, permissions et validation](invariants-permissions-validation.fr.md) : pourquoi un
  formulaire ne porte jamais de règle métier.
- [Le côté lecture](../proposals/read-side.fr.md), parties 2 et 3.
- La règle `authz/fields-by-schema` dans la [référence d'architecture](../ARCHITECTURE.fr.md).
