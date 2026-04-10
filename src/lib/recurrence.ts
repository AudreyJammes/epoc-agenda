import {
  addDays, addMonths, addYears,
  isBefore, isEqual, parseISO, format,
  getDay,
} from 'date-fns'
import type { Evenement, EvenementFormData, FrequenceRecurrence } from '../types'

// Encode les paramètres de récurrence en chaîne lisible (stockée dans recurrence_rule)
export function encodeRule(
  frequence: FrequenceRecurrence,
  jours: number[],  // pour hebdo : 0=lun…6=dim
  jusqu_au: string,
): string {
  const parts = [`FREQ=${frequence.toUpperCase()}`, `UNTIL=${jusqu_au}`]
  if (frequence === 'hebdomadaire' && jours.length > 0) {
    parts.push(`BYDAY=${jours.join(',')}`)
  }
  return parts.join(';')
}

// Convertit un numéro de jour (0=lun…6=dim) vers getDay() (0=dim…6=sam)
function jourSemaineVersGetDay(j: number): number {
  return (j + 1) % 7
}

// Génère toutes les occurrences d'une série récurrente
// Retourne un tableau de partiels Evenement (sans id/created_at/notif_envoyee)
export function genererOccurrences(
  form: EvenementFormData,
  recurrence_groupe_id: string,
  rule: string,
): Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee' | 'user_id'>[] {
  // Si pas de date de fin, générer sur 2 ans à partir de la date de début
  const dateRef = form.journee_entiere
    ? parseISO(form.date_journee)
    : new Date(`${form.date_debut}T${form.heure_debut}:00`)
  const jusqu_au = form.recurrence_jusqu_au
    ? parseISO(form.recurrence_jusqu_au)
    : addYears(dateRef, 50)
  const occurrences: Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee' | 'user_id'>[] = []
  const MAX_OCCURRENCES = 500 // sécurité

  function baseOccurrence(dateDebut: Date, dateFin: Date): Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee' | 'user_id'> {
    if (form.journee_entiere) {
      return {
        titre:                form.titre,
        type:                 form.type,
        journee_entiere:      true,
        date_journee:         format(dateDebut, 'yyyy-MM-dd'),
        date_fin_journee:     format(dateFin,   'yyyy-MM-dd'),
        date_debut:           null,
        date_fin:             null,
        contact_id:           form.contact_id || null,
        lieu:                 form.lieu || null,
        note:                 form.note || null,
        source:               'manuel',
        source_id:            null,
        recurrence_rule:      rule,
        recurrence_groupe_id,
      }
    } else {
      return {
        titre:                form.titre,
        type:                 form.type,
        journee_entiere:      false,
        date_journee:         null,
        date_fin_journee:     null,
        date_debut:           dateDebut.toISOString(),
        date_fin:             dateFin.toISOString(),
        contact_id:           form.contact_id || null,
        lieu:                 form.lieu || null,
        note:                 form.note || null,
        source:               'manuel',
        source_id:            null,
        recurrence_rule:      rule,
        recurrence_groupe_id,
      }
    }
  }

  function dureeMs(): number {
    if (form.journee_entiere) {
      const d1 = parseISO(form.date_journee)
      const d2 = form.date_fin_journee ? parseISO(form.date_fin_journee) : d1
      return d2.getTime() - d1.getTime()
    } else {
      return (
        new Date(`${form.date_debut}T${form.heure_fin}:00`).getTime() -
        new Date(`${form.date_debut}T${form.heure_debut}:00`).getTime()
      )
    }
  }

  const duree = dureeMs()

  if (form.recurrence_frequence === 'quotidien') {
    let cur = form.journee_entiere
      ? parseISO(form.date_journee)
      : new Date(`${form.date_debut}T${form.heure_debut}:00`)

    while ((isBefore(cur, jusqu_au) || isEqual(cur, jusqu_au)) && occurrences.length < MAX_OCCURRENCES) {
      const fin = new Date(cur.getTime() + duree)
      occurrences.push(baseOccurrence(cur, fin))
      cur = addDays(cur, 1)
    }

  } else if (form.recurrence_frequence === 'hebdomadaire') {
    const jours = form.recurrence_jours.length > 0 ? form.recurrence_jours : [
      form.journee_entiere
        ? parseISO(form.date_journee).getDay()
        : new Date(`${form.date_debut}T${form.heure_debut}:00`).getDay()
    ]

    // Parcourt jour par jour en cherchant les jours cochés
    let cur = form.journee_entiere
      ? parseISO(form.date_journee)
      : new Date(`${form.date_debut}T${form.heure_debut}:00`)

    const joursCibles = jours.map(jourSemaineVersGetDay)

    while ((isBefore(cur, jusqu_au) || isEqual(cur, jusqu_au)) && occurrences.length < MAX_OCCURRENCES) {
      if (joursCibles.includes(getDay(cur))) {
        const fin = new Date(cur.getTime() + duree)
        occurrences.push(baseOccurrence(cur, fin))
      }
      cur = addDays(cur, 1)
    }

  } else if (form.recurrence_frequence === 'mensuel') {
    let cur = form.journee_entiere
      ? parseISO(form.date_journee)
      : new Date(`${form.date_debut}T${form.heure_debut}:00`)

    while ((isBefore(cur, jusqu_au) || isEqual(cur, jusqu_au)) && occurrences.length < MAX_OCCURRENCES) {
      const fin = new Date(cur.getTime() + duree)
      occurrences.push(baseOccurrence(cur, fin))
      cur = addMonths(cur, 1)
    }

  } else if (form.recurrence_frequence === 'annuel') {
    let cur = form.journee_entiere
      ? parseISO(form.date_journee)
      : new Date(`${form.date_debut}T${form.heure_debut}:00`)

    while ((isBefore(cur, jusqu_au) || isEqual(cur, jusqu_au)) && occurrences.length < MAX_OCCURRENCES) {
      const fin = new Date(cur.getTime() + duree)
      occurrences.push(baseOccurrence(cur, fin))
      cur = addYears(cur, 1)
    }
  }

  return occurrences
}
