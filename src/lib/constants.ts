import type { TypeEvenement } from '../types'

export const TYPE_LABELS: Record<TypeEvenement, string> = {
  perso:               'Perso',
  ateliers:            'Ateliers',
  epoc:                'EPOC',
  fetes_anniversaires: 'Fêtes & anniversaires',
  relance:             'Relance',
  tache:               'Tâche',
}

// Couleurs Tailwind pour chaque type d'événement (palette EPOC)
export const TYPE_COLORS: Record<TypeEvenement, { bg: string; text: string; border: string; dot: string }> = {
  perso:               { bg: 'bg-epoc-violet/10', text: 'text-epoc-violet',  border: 'border-epoc-violet',  dot: 'bg-epoc-violet'  },
  ateliers:            { bg: 'bg-epoc-rose/10',   text: 'text-epoc-rose',    border: 'border-epoc-rose',    dot: 'bg-epoc-rose'    },
  epoc:                { bg: 'bg-epoc-navy/10',   text: 'text-epoc-navy',    border: 'border-epoc-navy',    dot: 'bg-epoc-navy'    },
  fetes_anniversaires: { bg: 'bg-epoc-orange/10', text: 'text-epoc-orange',  border: 'border-epoc-orange',  dot: 'bg-epoc-orange'  },
  relance:             { bg: 'bg-amber-100',      text: 'text-amber-800',    border: 'border-amber-400',    dot: 'bg-amber-500'    },
  tache:               { bg: 'bg-gray-100',       text: 'text-gray-700',     border: 'border-gray-400',     dot: 'bg-gray-400'     },
}

// Créneaux disponibles pour la planification automatique des tâches (heure locale)
export const CRENEAUX_PLANIFICATION = [
  { debut: 10, fin: 11 },
  { debut: 11, fin: 12 },
  { debut: 14, fin: 15 },
  { debut: 15, fin: 16 },
]

// Pas de temps pour le sélecteur d'heure (en minutes)
export const PAS_MINUTES = 5

// Heure de notification pour les événements journée entière (la veille à 12h00)
export const NOTIF_HEURE_JOURNEE_ENTIERE = 12
