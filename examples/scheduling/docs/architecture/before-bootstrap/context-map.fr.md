[English](context-map.md) · **Français**
<!-- translation-of: context-map.md sha256:1cff4ab9bee6ed91 -->

# Carte des contextes (ébauche)

| Aval | Amont | Patron | Ce qui traverse | Pourquoi ce patron |
|---|---|---|---|---|
| scheduling | identity | customer-supplier | les événements `identity.practice.member-added`, `identity.practice.member-removed` (une projection locale des praticiens, utilisée pour créer les calendriers et libeller les listes) ; le contrat de lecture `PersonDirectory` derrière une *gateway* (le nom affiché d'un patient sur une vue de détail) | scheduling est le cœur : ce dont il a besoin d'identity (le fuseau horaire du cabinet dans l'événement d'adhésion, une recherche groupée de noms) est planifié dans le travail d'identity |
| notification | scheduling | published-language | les événements `scheduling.appointment.booked`, `.confirmed`, `.rescheduled`, `.cancelled`, `.expired` | notification réagit ; scheduling ne sait rien des messages |
| notification | identity | published-language | l'événement `identity.person.registered` (une projection locale des contacts) | un contact est nécessaire au moment de l'envoi, même quand identity est indisponible |
| analytics | scheduling | conformist | les événements `scheduling.calendar.created`, `scheduling.appointment.booked`, `.rescheduled`, `.cancelled`, `.completed`, `.marked-no-show`, `.expired` ; le contrat de lecture `AppointmentExport` derrière une *gateway* (la source de la reconstruction d'une projection) | analytics mesure les faits de scheduling dans les termes de scheduling et n'a pas voix au chapitre ; une couche de traduction ne ferait que renommer |

Aucun cycle : identity est en amont de tout ce qu'il touche ; scheduling est en amont de
notification et d'analytics ; rien ne remonte.

## Deux façons de lire un autre contexte, une de chaque

- **Projection** (scheduling garde `practitioners` à partir des événements d'adhésion
  d'identity) : la donnée sert à décider (un calendrier n'est créé que pour un praticien du
  cabinet) et à libeller chaque ligne d'une liste ; elle doit être là quand identity ne l'est pas,
  et une liste ne peut pas faire un appel par ligne.
- **Gateway avec hydratation** (scheduling demande à identity le nom affiché d'un patient sur la
  vue de détail d'un rendez-vous) : un élément, lu rarement, dont le nom doit être le nom actuel,
  et que scheduling n'a aucune raison de stocker (les données personnelles restent là où elles
  sont possédées).

## Les délégations ne traversent pas comme des données

Une délégation est accordée dans identity et décide des droits sur les calendriers de
scheduling. Elle ne voyage pas comme un événement que scheduling copierait : identity écrit la
relation `desk:<practice>.<practitioner>#delegate@user:<assistant>`, scheduling écrit
`calendar:<id>#desk@desk:<practice>.<practitioner>`, et le modèle d'autorisation les joint
(*tuple to userset*). Les événements `identity.delegation.granted` et `.revoked` sont tout de même
publiés, pour le journal d'audit et pour de futurs consommateurs.

## Le journal d'audit

Une capacité de la plateforme, pas un contexte (argumenté dans `contexts.md`) : il consomme
chaque événement d'intégration sous le nom de consommateur `audit` et enregistre chaque décision
et chaque commande venues des bus.
