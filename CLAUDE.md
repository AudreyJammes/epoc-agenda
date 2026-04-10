# Contexte projet — Agenda EPOC

## Ce que c'est
Une PWA (Progressive Web App) d'agenda personnel pour Audrey Jammes (directrice d'EPOC), distincte du CRM mais partageant la même base Supabase.

## URLs
- **En ligne** : https://agenda.ecole-epoc.fr (domaine personnalisé)
- **Cloudflare Pages** : https://epoc-agenda.pages.dev
- **GitHub** : https://github.com/AudreyJammes/epoc-agenda (dépôt privé)
- **Supabase** : https://dyaiezuuxdfkjdfpilji.supabase.co (même instance que le CRM, région Paris)

## Stack technique
- React + TypeScript + Vite + Tailwind CSS (même stack que le CRM)
- `@tanstack/react-query` (état serveur)
- `date-fns` (manipulation des dates)
- `uuid` (génération des recurrence_groupe_id)
- `vite-plugin-pwa` + Workbox (PWA / Service Worker)
- Déploiement : Cloudflare Pages, auto-build depuis GitHub

## Architecture
```
epoc-agenda/src/
├── components/
│   ├── AlertePlanification.tsx  — Alerte tâches sans créneau disponible
│   ├── EvenementModal.tsx       — Formulaire création/édition événement (récurrence, lieu, contact)
│   ├── ImportICS.tsx            — Import de fichiers .ics (Mailo)
│   ├── MiniCalendrier.tsx       — Sidebar mini-calendrier avec points de couleur par type
│   ├── VueJour.tsx              — Vue jour avec grille horaire (7h-21h)
│   ├── VueMois.tsx              — Vue mois avec support multi-jours
│   └── VueSemaine.tsx           — Vue semaine avec bande J.E. + grille horaire
├── hooks/
│   ├── useAuth.ts               — Authentification Supabase
│   ├── useContacts.ts           — Lecture contacts CRM (autocomplétion dans le modal)
│   ├── useEvenements.ts         — CRUD événements + insert en masse + delete série
│   ├── useRelances.ts           — Lecture relances CRM (synchro → agenda)
│   └── useTaches.ts             — Lecture tâches CRM (planification automatique)
├── lib/
│   ├── constants.ts             — TYPE_LABELS, TYPE_COLORS, CRENEAUX_PLANIFICATION
│   ├── ics-parser.ts            — Parser .ics (RFC 5545), filtre avant 2026-01-01
│   ├── planification.ts         — trouverCreneau() + tacheVersEvenement()
│   ├── recurrence.ts            — encodeRule() + genererOccurrences() (max 500, défaut 50 ans)
│   └── supabase.ts              — Client Supabase
├── pages/
│   └── Agenda/index.tsx         — Page principale : header, sidebar, vues, modals, synchros
└── types/
    └── index.ts                 — Types TypeScript
```

## Base de données — Table `agenda_evenements`

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid | Clé primaire |
| `titre` | text | Titre de l'événement |
| `type` | text | `perso`, `ateliers`, `epoc`, `fetes_anniversaires`, `relance`, `tache` |
| `journee_entiere` | bool | Vrai si événement sans heure |
| `date_journee` | date | Date de début pour les journées entières |
| `date_fin_journee` | date | Date de fin pour les événements multi-jours |
| `date_debut` | timestamptz | Début pour les événements horaires |
| `date_fin` | timestamptz | Fin pour les événements horaires |
| `contact_id` | uuid | Lien optionnel vers un contact CRM |
| `lieu` | text | Lieu de l'événement |
| `note` | text | Note libre |
| `source` | text | `manuel`, `ics_import`, `crm_tache`, `crm_relance` |
| `source_id` | uuid | ID source (tâche ou relance CRM) |
| `notif_envoyee` | bool | Notification push déjà envoyée |
| `recurrence_rule` | text | RRULE (ex: `FREQ=WEEKLY;BYDAY=MO,WE`) |
| `recurrence_groupe_id` | uuid | Regroupe toutes les occurrences d'une série |
| `created_at` | timestamptz | Date de création |

RLS : lecture/écriture uniquement pour l'utilisateur authentifié (`auth.uid() = user_id`... à vérifier selon la politique configurée).

## Types d'événements et couleurs

| Type | Couleur | Usage |
|---|---|---|
| `perso` | Violet (`epoc-violet`) | Événements personnels |
| `ateliers` | Rose (`epoc-rose`) | Ateliers EPOC |
| `epoc` | Navy (`epoc-navy`) | Événements EPOC généraux |
| `fetes_anniversaires` | Orange (`epoc-orange`) | Fêtes et anniversaires |
| `relance` | Ambre | Relances (sync depuis CRM) |
| `tache` | Gris | Tâches (sync depuis CRM) |

## Fonctionnalités clés

### Vues
- **Jour** : grille horaire 7h-21h, 80px/heure
- **Semaine** : grille + bande journée entière sticky en haut
- **Mois** : grille mensuelle avec support multi-jours
- **Mini-calendrier** : sidebar desktop avec points de couleur

### Navigation
- Bouton "Aujourd'hui" + flèches ‹ › encadrant le sélecteur Jour/Sem./Mois
- Les flèches avancent/reculent d'1 jour, 1 semaine ou 1 mois selon la vue active

### Récurrence (Option B — occurrences pré-générées)
- Les occurrences sont stockées individuellement en base avec `recurrence_groupe_id` commun
- Fréquences : `hebdo` et `annuel`
- Sans date de fin : génère 50 ans d'occurrences (max 500)
- Supprimer une série = supprimer par `recurrence_groupe_id`

### Synchronisations automatiques (lecture seule depuis le CRM)
- **Tâches CRM** → créneau trouvé automatiquement (10h, 11h, 14h, 15h) avant l'échéance
- **Relances CRM** → converties en événements type `relance`

### Import ICS
- Fichier `.ics` exporté depuis Mailo
- Filtre les événements avant le 2026-01-01
- Insert par lots de 100

### Notifications push
- Via Service Worker
- 15 min avant pour les événements horaires
- La veille à 12h pour les journées entières

## Déploiement
1. Modifier les fichiers dans `epoc-agenda/src/`
2. `git add src/ && git commit && git push`
3. Cloudflare Pages rebuild automatiquement (~1 min)

⚠️ Le build utilise `tsc` strict — `noUnusedLocals` et `noUnusedParameters` sont actifs. Toute variable ou import inutilisé fait échouer le build.

## Liens CRM ↔ Agenda
- **Agenda → CRM** : bouton "↗ Ouvrir le CRM" dans le menu ⋯ → https://crm.ecole-epoc.fr
- **CRM → Agenda** : lien "Ouvrir l'Agenda" dans le menu utilisateur de `epoc-crm/src/components/Layout.tsx` → https://agenda.ecole-epoc.fr
