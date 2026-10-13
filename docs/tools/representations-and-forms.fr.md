[English](representations-and-forms.md) · **Français**
<!-- translation-of: representations-and-forms.md sha256:bdfdf95b6901cffc -->

# Représentations et formulaires : XML, CSV, JSON Forms et ses moteurs de rendu

**Résumé.** `@ddd-ts-kit/http` écrit du JSON, du XML et du CSV, lit du XML, négocie sur
`Accept`, réserve des champs à certains appelants et décrit des formulaires en JSON Forms et sous
forme d'un arbre de blocs neutre, sans aucune dépendance à l'exécution : l'analyseur et
l'écrivain XML et l'écrivain CSV sont ceux du *package*, petits à dessein. Cette page dit pourquoi
aucune bibliothèque n'a été prise pour XML et CSV, quel moteur de rendu JSON Forms utiliser côté
front-end, quelles sont les alternatives à JSON Forms, et les limites. Les versions ont été lues
avec `npm view` le 2026-10-13. Les concepts sont dans
[concepts/representations-and-forms.fr.md](../concepts/representations-and-forms.fr.md), le mode
d'emploi dans le [README de `@ddd-ts-kit/http`](../../packages/http/README.fr.md).

## XML : un analyseur propre au *package*, ou une bibliothèque

| Option | Licence | Ce qu'elle apporte | Pourquoi pas ici |
|---|---|---|---|
| Celui du *package* (`XmlRepresentation`) | MIT, dans le *package* | les éléments, les attributs, les CDATA, les commentaires, les instructions de traitement, les cinq entités prédéfinies et les références de caractères ; aucune déclaration de type de document, donc aucune entité du tout ; 64 niveaux au plus ; lit selon le schéma de réponse | c'est le choix retenu : un corps n'a pas besoin de plus, et refuser les DTD ferme XXE et les bombes d'expansion par construction plutôt que par une option à ne pas oublier |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) 5.11.2 | MIT | rapide, avec validation, un constructeur, des options sur les entités | la correspondance entre XML et le modèle JSON est de toute façon la nôtre (elle suit le schéma) ; une dépendance pair facultative de plus pour ce que font 200 lignes |
| [xmlbuilder2](https://github.com/oozcitak/xmlbuilder2) 4.0.3 | MIT | un DOM complet, les espaces de noms, la sérialisation | lourd pour écrire une seule valeur ; un DOM n'est pas nécessaire pour diffuser une liste en flux |
| [sax](https://github.com/isaacs/sax-js) 1.6.1 | BlueOak-1.0.0 | un analyseur en flux | les corps de requête HTTP sont bornés par l'analyseur de corps du framework ; les lectures en flux ne sont pas nécessaires |

Prenez une bibliothèque dans votre propre couche anticorruption quand un partenaire impose des
espaces de noms, du contenu mixte ou un XML Schema : ce format est un modèle à part, mis en
correspondance avec le vôtre, pas une représentation du vôtre.

## CSV : écrit par le *package*

| Option | Licence | Pourquoi pas ici |
|---|---|---|
| Celui du *package* (`CsvRepresentation`) | MIT, dans le *package* | retenu : les guillemets de la RFC 4180, un en-tête tiré du schéma, la diffusion en flux, et la garde contre les formules ci-dessous |
| [csv-stringify](https://csv.js.org/stringify/) 6.9.0 | MIT | un bon choix pour un import ou pour des options que le kit n'offre pas (séparateurs, BOM) ; pas nécessaire pour écrire des lignes plates |
| [Papa Parse](https://www.papaparse.com/) 5.7.0 | MIT | d'abord un analyseur ; CSV n'est jamais lu par une route ici |

Une cellule de texte qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot est
préfixée par `'` (le conseil de l'OWASP contre l'injection CSV) ; un nombre n'est jamais touché.
Un consommateur qui a besoin de retrouver le texte brut retire ce seul caractère.

## Formulaires : JSON Forms côté front-end

L'arbre de blocs neutre est le modèle du kit ; JSON Forms est son premier *mapper*, recommandé
parce que des moteurs de rendu maintenus existent pour les trois frameworks courants, tous sous
licence MIT et publiés ensemble (3.8.0) :

| Front-end | *Packages* | Remarques |
|---|---|---|
| React | `@jsonforms/core`, `@jsonforms/react`, `@jsonforms/material-renderers` (MUI) ou `@jsonforms/vanilla-renderers` | l'ensemble le plus utilisé ; des moteurs de rendu sur mesure par testeur et par rang |
| Angular | `@jsonforms/core`, `@jsonforms/angular`, `@jsonforms/angular-material` | les contrôles d'Angular Material |
| Vue | `@jsonforms/core`, `@jsonforms/vue`, `@jsonforms/vue-vanilla` ou `@jsonforms/vue-vuetify` | Vue 3 |

```tsx
// React : les trois parties de la réponse, telles quelles
const { schema, uischema, data } = await (await fetch('/forms/bookAppointment?calendarId=c-1')).json();

<JsonForms schema={schema} uischema={uischema} data={data} renderers={materialRenderers} cells={materialCells}
  i18n={{ translate: (key) => messages[key] }} onChange={({ data }) => setBooking(data)} />
```

Ce qui correspond à quoi :

| Dans la description | Dans JSON Forms | Un moteur de rendu montre |
|---|---|---|
| un groupe | un élément `Group`, une clé `i18n` | une section avec un titre |
| un champ | un `Control` avec un `scope`, une clé `i18n` | le contrôle du type de son schéma |
| en lecture seule | `readOnly: true` dans le schéma et `options.readonly` | un contrôle désactivé |
| un objet en lecture seule | `readOnly: true` sur l'objet, et `options.readonly` sur chacun de ses contrôles | un groupe de contrôles désactivés |
| le formulaire refusé à l'appelant | un `403` au lieu du formulaire | le message du front-end : l'utilisateur ne peut pas exécuter le cas d'usage |
| caché pour l'appelant | absent des deux schémas | rien |
| `widget: 'textarea'`, `'radio'` | `options.multi`, `options.format: 'radio'` | une saisie sur plusieurs lignes, des boutons radio |
| `widget: 'datetime'`, `'date'`, `'time'` | le `format` de la propriété | un sélecteur de date et d'heure, de date ou d'heure |
| des options d'un vocabulaire fermé | `enum` | une liste déroulante |
| `visibleWhen` | une règle `SHOW` | le contrôle apparaît quand la condition est vraie |
| `requiredWhen` | `allOf` de `if`/`then` dans le schéma | une erreur tant que le champ est vide |
| `lookup` | `options.lookup` (opération, méthode, chemin) | rien en soi : un moteur de rendu sur mesure appelle la route |

Une consultation (*lookup*) est la seule partie qu'aucun moteur de rendu standard ne comprend :
enregistrez un moteur de rendu sur mesure pour les contrôles qui portent `options.lookup`, qui
appelle la route et remplit les options.

### Alternatives à JSON Forms

| Bibliothèque | Licence | Convient quand |
|---|---|---|
| [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/) (`@rjsf/core` 6.11.0) | Apache-2.0 | une application React qui s'en sert déjà : donnez-lui le `schema` de la réponse JSON Forms ; son propre schéma d'interface est un autre dialecte, obtenu de l'arbre de blocs |
| [Formly](https://formly.dev/) (`@ngx-formly/core` 9.0.0) | MIT | une application Angular déjà sur Formly : faites correspondre l'arbre de blocs à sa configuration de champs |
| [uniforms](https://uniforms.tools/) 4.0.0 | MIT | React avec un pont de schéma ; JSON Schema est l'un de ses ponts |
| l'arbre de blocs, rendu à la main | | un *design system* à vous : les groupes, les champs, les *widgets* et les options sont déjà résolus pour l'appelant |

Les autres dialectes sont de petits *mappers* de l'arbre de blocs, écrits dans le front-end, pas
dans le kit.

## Limites

- Des clés de traduction seulement : le serveur n'envoie aucun texte de libellé. Le front-end
  possède ses messages.
- Les conditions sont simples : un champ égal à une valeur, ou à l'une de plusieurs. Une
  condition sur plusieurs champs est une règle métier, à laquelle répond la commande.
- Le formulaire décrit le corps d'une seule route ; un assistant en plusieurs étapes sur
  plusieurs routes relève du front-end.
- Le XML du kit a au plus un espace de noms par défaut, sur la racine, et aucun contenu mixte.
- JSON Forms valide avec AJV dans le navigateur : ce qu'il accepte, le serveur peut encore le
  refuser, par une règle métier ou par un champ que l'appelant ne peut pas poser.
- Un moteur de rendu qui ignore `readOnly` sur un groupe d'objet (certains ensembles *vanilla*)
  désactive tout de même ses contrôles, qui portent chacun `options.readonly`.

## Voir aussi

- [Frameworks HTTP](http-frameworks.fr.md) : comment chaque adaptateur lit un corps XML.
- [Moteurs d'autorisation](authorization-engines.fr.md) : les décisions qu'utilise une exigence
  sur un champ.
- [Validation](validation.fr.md) : les schémas dont sont tirés les représentations et les
  formulaires.
