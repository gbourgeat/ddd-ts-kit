[English](discovery.md) · **Français**
<!-- translation-of: discovery.md sha256:ff31754937339c14 -->

# Découverte du domaine

Un *event storming* léger, par écrit, à partir de `needs.md`. Les mots sont ceux des cabinets.

## Chronologie

| # | Acteur | Commande | Événement du domaine | Ensuite (politique) | Doit voir (modèle de lecture) |
|---|---|---|---|---|---|
| 1 | Personne (première connexion) | Enregistrer la personne | Personne enregistrée | | |
| 2 | Administrateur de la plateforme | Ouvrir un cabinet | Cabinet ouvert | chaque fois qu'un cabinet est ouvert, le premier responsable en est membre | |
| 3 | Responsable de cabinet | Ajouter un membre (praticien, assistant, responsable) | Membre ajouté | chaque fois qu'un praticien a été ajouté, scheduling le connaît | Membres du cabinet |
| 4 | Responsable de cabinet | Retirer un membre | Membre retiré | chaque fois qu'un membre est retiré, ses délégations prennent fin | Membres du cabinet |
| 5 | Praticien, responsable de cabinet | Accorder une délégation (à un assistant, jusqu'à une date, avec ou sans les disponibilités) | Délégation accordée | | Assistants du cabinet |
| 6 | Praticien, responsable de cabinet | Révoquer une délégation | Délégation révoquée | | Délégations données |
| 7 | Le temps (toutes les 5 minutes) | Faire expirer les délégations | Délégation expirée | | |
| 8 | Praticien, responsable de cabinet | Créer un calendrier | Calendrier créé | chaque fois qu'un calendrier est créé, analytics le suit | Praticiens du cabinet |
| 9 | Praticien, délégué avec les disponibilités, responsable de cabinet | Fixer les horaires d'ouverture | Horaires d'ouverture fixés | | Le calendrier |
| 10 | idem | Ajouter une exception (jour fermé, ouverture exceptionnelle) | Exception ajoutée | | Le calendrier |
| 11 | idem | Ajouter une indisponibilité | Indisponibilité ajoutée | | Rendez-vous de la période |
| 12 | idem | Définir un type de rendez-vous (durée, grille, battement) | Type de rendez-vous défini | | |
| 13 | Patient, délégué, praticien, responsable de cabinet | Réserver un rendez-vous | Rendez-vous réservé (ou Rendez-vous demandé quand le type demande une confirmation) | chaque fois qu'il est réservé, prévenir le patient ; analytics le compte | Créneaux libres d'un jour |
| 14 | Patient | Confirmer le rendez-vous | Rendez-vous confirmé | chaque fois qu'il est confirmé, prévenir le patient | Mes rendez-vous |
| 15 | Le temps (toutes les 5 minutes) | Faire expirer les rendez-vous non confirmés | Rendez-vous expiré | chaque fois qu'il a expiré, proposer le créneau à la liste d'attente | |
| 16 | Patient, délégué, praticien, responsable de cabinet | Déplacer le rendez-vous | Rendez-vous déplacé | chaque fois qu'il est déplacé, prévenir ; proposer l'ancien créneau à la liste d'attente | Créneaux libres, le rendez-vous |
| 17 | Patient (jusqu'à 24 h avant), délégué, praticien (avec un motif), responsable de cabinet | Annuler le rendez-vous | Rendez-vous annulé | chaque fois qu'il est annulé, prévenir ; proposer le créneau à la liste d'attente ; analytics le compte | Mes rendez-vous, le jour d'un calendrier |
| 18 | Praticien, délégué, responsable de cabinet | Terminer le rendez-vous | Rendez-vous terminé | analytics le compte | Le jour d'un calendrier |
| 19 | Praticien, délégué, responsable de cabinet | Marquer une absence | Rendez-vous marqué en absence | analytics le compte | Le jour d'un calendrier |
| 20 | Patient | Rejoindre la liste d'attente (calendrier, jour, type de rendez-vous) | Liste d'attente rejointe | | Un jour complet |
| 21 | Système (politique de 15, 16, 17) | Proposer le créneau libéré | Créneau proposé (à la première personne en attente à qui il convient, retenu jusqu'à une échéance) | chaque fois qu'un créneau est proposé, prévenir la personne en attente | Personnes en attente du jour, dans l'ordre |
| 22 | Patient (la personne en attente) | Accepter la proposition | Proposition acceptée, puis Rendez-vous réservé | | La proposition |
| 23 | Le temps (chaque minute) | Faire expirer les propositions | Proposition expirée | chaque fois qu'une proposition expire, proposer le créneau à la personne suivante | |
| 24 | Le temps (toutes les 15 minutes) | Envoyer les rappels dus | Rappel envoyé (une fois par rendez-vous et par début) | | Rendez-vous qui commencent dans 24 h |
| 25 | Système (politique de 13, 14, 16, 17, 21) | Envoyer une notification | Notification envoyée, ou Notification en échec | | Coordonnées de la personne |
| 26 | Le temps (chaque nuit) | Vérifier l'occupation (construit, puis retiré après la livraison : l'occupation est mesurée au moment où elle est lue, voir `slices.md`, note de 37) | Occupation vérifiée | | |
| 27 | Responsable de cabinet, praticien | (lectures) | | | Occupation, annulations, absences par calendrier et par jour |
| 28 | Support | (lectures au nom d'un utilisateur) | | chaque regard est enregistré | Ce que voit l'utilisateur |
| 29 | Administrateur de la plateforme | (lectures) | | | Qui a fait quoi, à qui on a refusé quoi |

## Systèmes externes

| Système | Utilisé pour | Sens | Ce qui se passe quand il est indisponible |
|---|---|---|---|
| Keycloak | la connexion, l'identité et le rôle d'une personne | entrant (jetons) | personne ne se connecte ; rien n'est perdu |
| Fournisseur de courriel | confirmations, rappels, avis | sortant | la notification fait l'objet de nouvelles tentatives, puis est mise de côté et signalée ; le rendez-vous n'est pas affecté |
| Outil de suivi des erreurs (protocole Sentry) | échecs inattendus | sortant | les échecs sont toujours journalisés |
| Backend de traces (OTLP) | traces | sortant | rien d'autre n'est affecté |

## Règles entendues

- Les horaires d'ouverture sont des heures murales du fuseau horaire du cabinet ; un jour de 23 ou 25 heures les garde.
- Un créneau commence sur la grille de son type de rendez-vous, dure sa durée, et se trouve dans une seule plage d'ouverture de ce jour.
- Une exception remplace les horaires hebdomadaires de son jour : fermé, ou d'autres plages.
- Une indisponibilité ferme tout ce qu'elle couvre, ouvertures exceptionnelles comprises.
- Un battement après un rendez-vous fait partie du temps qu'il occupe sur le calendrier.
- Un rendez-vous ne chevauche jamais un autre rendez-vous actif du même calendrier, ni une indisponibilité, et ne sort pas des horaires d'ouverture. Deux réservations d'un même créneau au même instant : exactement une gagne.
- Fenêtre de réservation : pas avant le préavis minimal du calendrier, pas après son horizon maximal.
- Un patient détient au plus N rendez-vous futurs actifs avec le même praticien (N appartient au calendrier ; 3 par défaut).
- Un type de rendez-vous qui demande une confirmation donne un rendez-vous demandé, qui retient son créneau et expire quand il n'est pas confirmé à temps.
- Déplacer déplace la réservation : jamais deux créneaux, jamais aucun.
- Une annulation enregistre qui (le patient ou le cabinet) et le motif ; le cabinet en donne toujours un.
- Un patient annule ou déplace jusqu'à 24 heures avant le début.
- Terminé et absence ne se disent qu'après le début. Un rendez-vous annulé, expiré, terminé ou marqué en absence ne change plus.
- La liste d'attente d'un calendrier et d'un jour est servie dans l'ordre d'arrivée ; une proposition est retenue 30 minutes pour une personne en attente, puis passe à la suivante ; une personne en attente n'est servie qu'une fois.
- Un rappel par rendez-vous et par début : un rendez-vous déplacé fait l'objet d'un nouveau rappel pour son nouveau début.
- Une délégation couvre les calendriers d'un praticien dans un cabinet, pour un assistant de ce cabinet ; elle prend fin à sa date, à sa révocation, ou quand l'un des deux quitte le cabinet.
- Un délégué ne change les disponibilités que lorsque la délégation le dit.
- Un responsable de cabinet gère chaque calendrier de son cabinet et rien d'un autre.
- Dans une vue partagée, un patient voit un créneau pris comme occupé, sans le nom.
- Le support lit au nom d'un utilisateur, n'écrit jamais, et chaque regard est enregistré.

## Mots à plusieurs sens

| Mot | Sens pour qui |
|---|---|
| Calendrier | pour un praticien : l'agenda qu'il ouvre à la réservation ; pour analytics : une ligne dont l'occupation est mesurée |
| Patient | pour scheduling : la personne pour qui est un rendez-vous ; pour identity : une personne comme une autre ; pour notification : un destinataire |
| Praticien | pour identity : un membre d'un cabinet avec ce rôle ; pour scheduling : le propriétaire de calendriers |
| Créneau | pour un patient : un moment qu'il peut réserver ; pour la liste d'attente : un moment qui a été libéré et qui est proposé |
| Annulation | pour scheduling : une fin de rendez-vous avec une partie et un motif ; pour analytics : un nombre par jour |
| Membre | pour identity : une personne avec un rôle dans un cabinet ; scheduling ne connaît que les praticiens |

## Points chauds

- Une organisation regroupe-t-elle plusieurs cabinets ? Pas dans les besoins : le cabinet est l'unité gardée à part. *Product owner*.
- Un patient peut-il déplacer dans les 24 heures ? Pris comme non, comme pour l'annulation. *Product owner*.
- L'indisponibilité est-elle refusée quand des rendez-vous y existent déjà ? Pris comme : refusée, le cabinet les annule ou les déplace d'abord. Praticiens.
- Une absence compte-t-elle dans la limite du patient, ou bloque-t-elle la réservation ? Pas demandé. *Product owner*.
- Quel canal pour les notifications au-delà du courriel ? Le courriel seulement pour l'instant. *Product owner*.
