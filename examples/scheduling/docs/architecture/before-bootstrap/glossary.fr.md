[English](glossary.md) · **Français**
<!-- translation-of: glossary.md sha256:71514b0a98fe693d -->

# Langage omniprésent (avant l'amorçage)

Une section par contexte. L'amorçage transforme chaque ligne en un `--term` de `generate context`
et supprime ce fichier : les termes vivent alors dans chaque `CONTEXT.md` et nulle part ailleurs.

## identity

| Terme | Sens | À ne pas confondre avec |
|---|---|---|
| Person (personne) | Quelqu'un que la plateforme connaît par l'identité qu'a émise le fournisseur d'identité, avec un nom affiché et une adresse de contact | scheduling : Patient, le rôle qu'une personne tient dans un rendez-vous |
| Register (inscrire) | Faire connaître une personne à la plateforme lors de sa première connexion | |
| Practice (cabinet) | Un lieu où des praticiens reçoivent des personnes, dans un seul fuseau horaire, administré par ses responsables | |
| Open (ouvrir) | Créer un cabinet avec son premier responsable | scheduling : les horaires d'ouverture |
| Member (membre) | Une personne qui a un rôle dans un cabinet : responsable, praticien ou assistant | |
| Membership (adhésion) | Le fait qu'une personne soit membre d'un cabinet avec un rôle | |
| Add (ajouter) | Faire d'une personne un membre d'un cabinet | |
| Remove (retirer) | Mettre fin à une adhésion ; les délégations de ce membre prennent fin avec elle | |
| Manager (responsable) | Un membre qui administre un cabinet | |
| Practitioner (praticien) | Un membre qui reçoit des personnes | scheduling : le propriétaire de calendriers |
| Assistant (assistant) | Un membre qui tient l'accueil et peut recevoir des délégations | |
| Delegation (délégation) | La permission qu'un praticien donne à un assistant du même cabinet de gérer ses calendriers, jusqu'à une fin facultative, avec ou sans le droit de changer les disponibilités | |
| Grant (accorder) | Donner une délégation | |
| Revoke (révoquer) | Retirer une délégation avant sa fin | |
| Expire (expirer) | Mettre fin à une délégation parce que sa date de fin est passée | scheduling : un rendez-vous non confirmé expire |
| Desk (poste) | Le poste d'un praticien dans un cabinet : ce sur quoi une délégation est donnée | |
| Directory (annuaire) | La réponse à « qui est cette personne », donnée aux autres contextes | |

## scheduling

| Terme | Sens | À ne pas confondre avec |
|---|---|---|
| Calendar (calendrier) | L'agenda qu'un praticien ouvre à la réservation dans un cabinet, avec ses disponibilités et ses règles de réservation | analytics : une ligne que l'on mesure |
| Create (créer) | Ouvrir un nouveau calendrier pour un praticien | |
| Practitioner (praticien) | Le propriétaire de calendriers, connu par identity | identity : un membre avec un rôle |
| Patient (patient) | La personne pour qui est un rendez-vous | identity : Person |
| Availability (disponibilités) | Quand un calendrier peut être réservé : horaires d'ouverture, exceptions et indisponibilités ensemble | |
| Opening hours (horaires d'ouverture) | Les plages hebdomadaires, à l'heure murale du cabinet, pendant lesquelles un calendrier prend des rendez-vous | |
| Range (plage) | Un intervalle d'une journée entre deux heures murales | Slot, qui est un intervalle entre deux instants |
| Exception (exception) | Un jour dont les horaires remplacent ceux de la semaine : fermé, ou ouvert sur d'autres plages | Time off |
| Time off (indisponibilité) | Une période pendant laquelle rien ne peut être réservé, quels que soient les horaires | Exception |
| Appointment type (type de rendez-vous) | Une sorte de rendez-vous qu'offre un calendrier, avec sa durée, sa grille, son battement et le fait qu'il demande ou non une confirmation | |
| Duration (durée) | Combien de temps dure un rendez-vous d'un type | |
| Grid (grille) | Le pas, en minutes depuis minuit, sur lequel commencent les rendez-vous d'un type | |
| Buffer (battement) | Le temps gardé libre après un rendez-vous, compris dans ce qu'il occupe | |
| Booking window (fenêtre de réservation) | Le plus tôt et le plus tard où un créneau peut être réservé : un préavis minimal et un horizon maximal | |
| Notice (préavis) | Le temps minimal entre la réservation et le début | notification : un message |
| Horizon (horizon) | Le temps maximal entre la réservation et le début | |
| Limit (limite) | Le nombre de rendez-vous futurs qu'un patient peut détenir avec un même praticien | |
| Slot (créneau) | Un intervalle de temps sur un calendrier qu'un rendez-vous occupe ou pourrait occuper | Range |
| Scheduler (planificateur) | Le gardien des règles qui dit si un créneau peut être pris sur un calendrier, compte tenu de ce que le calendrier occupe déjà | |
| Appointment (rendez-vous) | L'occupation d'un créneau sur un calendrier pour un patient, de la réservation à sa fin | |
| Book (réserver) | Prendre un créneau libre pour un patient | Request |
| Request (demander) | Prendre un créneau que le patient doit encore confirmer | |
| Confirm (confirmer) | Dire qu'un rendez-vous demandé sera honoré | |
| Reschedule (déplacer) | Déplacer un rendez-vous vers un autre créneau du même calendrier, en une seule étape | |
| Cancel (annuler) | Mettre fin à un rendez-vous avant qu'il ait lieu, en disant qui et pourquoi | Expire |
| Cancellation (annulation) | Qui a annulé (le patient ou le cabinet) et la raison donnée | analytics : un décompte |
| Reason (raison) | Les mots donnés pour une annulation | |
| Expire (expirer) | Mettre fin à un rendez-vous demandé qui n'a pas été confirmé à temps | Cancel |
| Complete (terminer) | Dire qu'un rendez-vous a eu lieu | |
| No show (absence) | Le patient n'est pas venu | |
| Mark (constater) | Enregistrer une absence après le début | |
| Waitlist (liste d'attente) | Les personnes qui attendent un créneau libéré sur un calendrier et un jour, par ordre d'arrivée | |
| Waiter (personne en attente) | Un patient sur une liste d'attente, pour un type de rendez-vous | |
| Join (rejoindre) | Entrer dans une liste d'attente | |
| Leave (quitter) | Sortir d'une liste d'attente | |
| Offer (offre) | Un créneau libéré réservé à une personne en attente jusqu'à une échéance | |
| Hold (réservation temporaire) | Le temps pendant lequel une offre attend sa personne en attente | |
| Agenda (agenda) | Les rendez-vous d'un calendrier ou d'un cabinet sur une journée, tels que les voient ceux qui le font tourner | |
| Day (jour) | Une date du calendrier dans le fuseau horaire du cabinet | |
| Time zone (fuseau horaire) | Le fuseau dont le cabinet suit l'heure murale | |
| Free (libre) | Occupé par aucun rendez-vous, aucune indisponibilité, aucune heure de fermeture | |
| Busy (occupé) | Occupé, sans dire par qui | |

## notification

| Terme | Sens | À ne pas confondre avec |
|---|---|---|
| Notification (notification) | Un message envoyé à une personne au sujet d'un fait d'un rendez-vous | scheduling : Notice |
| Send (envoyer) | Remettre une notification au fournisseur de courriel | |
| Recipient (destinataire) | La personne à qui est destinée une notification | scheduling : Patient |
| Contact (contact) | L'adresse à laquelle on joint un destinataire | |
| Confirmation (confirmation) | La notification qu'un rendez-vous est réservé ou confirmé | |
| Reminder (rappel) | La notification due 24 heures avant le début d'un rendez-vous, une fois par rendez-vous et par début | |
| Plan (planifier) | Programmer le rappel d'un rendez-vous | |
| Due (dû) | Dont l'heure d'envoi est venue | |
| Withdraw (retirer) | Abandonner un rappel planifié parce que son rendez-vous a pris fin ou a été déplacé | scheduling : Cancel |
| Mailer (*mailer*) | Le fournisseur de courriel, vu d'ici | |

## analytics

| Terme | Sens | À ne pas confondre avec |
|---|---|---|
| Occupancy (occupation) | Le temps occupé par des rendez-vous sur un calendrier au cours d'une journée, avec leur nombre | |
| Outcome (issue) | Où en est un rendez-vous pour la mesure : occupé, terminé, absence, annulé par le patient, annulé par le cabinet, expiré | scheduling : le rendez-vous lui-même |
| Cancellation (annulation) | Un décompte des rendez-vous annulés sur une journée, par partie | scheduling : qui et pourquoi |
| No show (absence) | Un décompte des rendez-vous dont le patient n'est pas venu | |
| Calendar (calendrier) | Une ligne dont on mesure l'occupation, dans un cabinet | scheduling : l'agenda |
| Day (jour) | Une date du calendrier dans le fuseau horaire du cabinet | |
| Verify (vérifier) | Recalculer les chiffres des derniers jours à partir des issues et corriger un écart | |
