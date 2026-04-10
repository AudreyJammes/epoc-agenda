export type TypeEvenement = 'perso' | 'ateliers' | 'epoc' | 'fetes_anniversaires' | 'relance' | 'tache'
export type SourceEvenement = 'manuel' | 'ics_import' | 'crm_tache' | 'crm_relance'
export type FrequenceRecurrence = 'quotidien' | 'hebdomadaire' | 'mensuel' | 'annuel'

export interface Evenement {
  id: string
  titre: string
  type: TypeEvenement
  date_debut: string | null
  date_fin: string | null
  journee_entiere: boolean
  date_journee: string | null
  date_fin_journee: string | null
  contact_id: string | null
  lieu: string | null
  note: string | null
  source: SourceEvenement
  source_id: string | null
  recurrence_rule: string | null
  recurrence_groupe_id: string | null
  user_id: string | null
  notif_envoyee: boolean
  created_at: string
}

export interface Contact {
  id: string
  prenom: string | null
  nom: string | null
  email: string | null
  telephone: string | null
  organisation_id: string | null
}

export interface Tache {
  id: string
  titre: string
  description: string | null
  statut: 'à faire' | 'en cours' | 'terminé'
  date_echeance: string | null
  priorite: 'haute' | 'moyenne' | 'basse' | null
  contact_id: string | null
  planning_impossible: boolean | null
}

export interface Relance {
  id: string
  contact_id: string
  titre: string
  date: string
  heure: string | null
  duree: number | null
}

export interface EvenementFormData {
  titre: string
  type: TypeEvenement
  journee_entiere: boolean
  date_journee: string
  date_fin_journee: string        // pour multi-jours
  date_debut: string
  heure_debut: string
  heure_fin: string
  contact_id: string
  lieu: string
  note: string
  // Récurrence
  recurrence: boolean
  recurrence_frequence: FrequenceRecurrence
  recurrence_jours: number[]      // 0=lun … 6=dim (pour hebdo)
  recurrence_jusqu_au: string
}
