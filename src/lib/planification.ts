import { addDays, setHours, setMinutes, setSeconds, setMilliseconds, isBefore, isEqual, format } from 'date-fns'
import { CRENEAUX_PLANIFICATION } from './constants'
import type { Evenement, Tache } from '../types'

interface CreneauOccupe {
  debut: Date
  fin: Date
}

// Extrait les créneaux occupés dans la journée (pour les événements à heure définie)
function creneauxOccupesDuJour(evenements: Evenement[], jour: Date): CreneauOccupe[] {
  const jourStr = format(jour, 'yyyy-MM-dd')
  return evenements
    .filter(e => !e.journee_entiere && e.date_debut)
    .filter(e => e.date_debut!.startsWith(jourStr))
    .map(e => ({
      debut: new Date(e.date_debut!),
      fin:   e.date_fin ? new Date(e.date_fin) : new Date(new Date(e.date_debut!).getTime() + 60 * 60 * 1000),
    }))
}

function creneauLibre(debut: Date, fin: Date, occupes: CreneauOccupe[]): boolean {
  return !occupes.some(o => isBefore(debut, o.fin) && isBefore(o.debut, fin))
}

function makeDebut(jour: Date, heure: number): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(new Date(jour), heure), 0), 0), 0)
}

// Trouve le premier créneau libre pour une tâche.
// Cherche de aujourd'hui jusqu'à la veille de date_echeance incluse.
// Retourne null si aucun créneau disponible.
export function trouverCreneau(
  tache: Tache,
  evenements: Evenement[]
): { debut: Date; fin: Date } | null {
  if (!tache.date_echeance) return null

  const echeance = new Date(tache.date_echeance + 'T00:00:00')
  const veille   = addDays(echeance, -1)
  let   jour     = new Date()
  // Normaliser à minuit local
  jour = setMilliseconds(setSeconds(setMinutes(setHours(jour, 0), 0), 0), 0)

  while (isBefore(jour, echeance) || isEqual(jour, veille)) {
    const occupes = creneauxOccupesDuJour(evenements, jour)

    for (const creneau of CRENEAUX_PLANIFICATION) {
      const debut = makeDebut(jour, creneau.debut)
      const fin   = makeDebut(jour, creneau.fin)

      // Ne pas planifier dans le passé
      if (isBefore(debut, new Date())) {
        continue
      }

      if (creneauLibre(debut, fin, occupes)) {
        return { debut, fin }
      }
    }

    jour = addDays(jour, 1)
    if (isBefore(veille, jour) && !isEqual(jour, veille)) break
  }

  return null
}

// Construit l'objet événement à insérer dans agenda_evenements pour une tâche
export function tacheVersEvenement(
  tache: Tache,
  creneau: { debut: Date; fin: Date }
): Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee'> {
  return {
    titre:           tache.titre,
    type:            'tache',
    journee_entiere: false,
    date_journee:    null,
    date_debut:      creneau.debut.toISOString(),
    date_fin:        creneau.fin.toISOString(),
    contact_id:      tache.contact_id ?? null,
    note:            tache.description ?? null,
    source:          'crm_tache',
    source_id:       tache.id,
  }
}
