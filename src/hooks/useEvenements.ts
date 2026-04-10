import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Evenement, EvenementFormData } from '../types'
import { format } from 'date-fns'

// Charge tous les événements du mois donné (+ débordement ±7 jours)
export function useEvenements(annee: number, mois: number) {
  return useQuery({
    queryKey: ['evenements', annee, mois],
    queryFn: async () => {
      const debut = new Date(annee, mois - 1, 1)
      debut.setDate(debut.getDate() - 7)
      const fin = new Date(annee, mois, 1)
      fin.setDate(fin.getDate() + 7)

      const debutStr = format(debut, 'yyyy-MM-dd')
      const finStr   = format(fin,   'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('agenda_evenements')
        .select('*')
        .or(
          `and(journee_entiere.eq.false,date_debut.gte.${debutStr}T00:00:00Z,date_debut.lte.${finStr}T23:59:59Z),` +
          `and(journee_entiere.eq.true,date_journee.gte.${debutStr},date_journee.lte.${finStr})`
        )
        .order('date_debut', { ascending: true })

      if (error) throw error
      return (data ?? []) as Evenement[]
    },
  })
}

// Charge tous les événements (pour la logique de planification)
export function useAllEvenements() {
  return useQuery({
    queryKey: ['evenements', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agenda_evenements')
        .select('*')
      if (error) throw error
      return (data ?? []) as Evenement[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

// Crée un événement depuis le formulaire
export function useCreateEvenement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (form: EvenementFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      let payload: Partial<Evenement>

      if (form.journee_entiere) {
        payload = {
          titre:            form.titre,
          type:             form.type,
          journee_entiere:  true,
          date_journee:     form.date_journee,
          date_fin_journee: form.date_fin_journee || form.date_journee,
          date_debut:       null,
          date_fin:         null,
          contact_id:       form.contact_id || null,
          lieu:             form.lieu || null,
          note:             form.note || null,
          source:           'manuel',
          user_id:          user?.id ?? null,
        }
      } else {
        const debut = new Date(`${form.date_debut}T${form.heure_debut}:00`)
        const fin   = new Date(`${form.date_debut}T${form.heure_fin}:00`)
        payload = {
          titre:            form.titre,
          type:             form.type,
          journee_entiere:  false,
          date_journee:     null,
          date_fin_journee: null,
          date_debut:       debut.toISOString(),
          date_fin:         fin.toISOString(),
          contact_id:       form.contact_id || null,
          lieu:             form.lieu || null,
          note:             form.note || null,
          source:           'manuel',
          user_id:          user?.id ?? null,
        }
      }

      const { data, error } = await supabase
        .from('agenda_evenements')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return data as Evenement
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements'] })
    },
  })
}

// Met à jour un événement
export function useUpdateEvenement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Evenement> & { id: string }) => {
      const { data, error } = await supabase
        .from('agenda_evenements')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Evenement
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements'] })
    },
  })
}

// Supprime un événement
export function useDeleteEvenement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agenda_evenements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements'] })
    },
  })
}

// Insère en masse des événements par lots de 100 (import ICS ou planification)
export function useInsertEvenementsEnMasse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (evenements: Omit<Evenement, 'id' | 'created_at' | 'notif_envoyee' | 'user_id'>[]) => {
      const { data: { user } } = await supabase.auth.getUser()
      const TAILLE_LOT = 100
      const resultats: Evenement[] = []

      for (let i = 0; i < evenements.length; i += TAILLE_LOT) {
        const lot = evenements.slice(i, i + TAILLE_LOT).map(e => ({ ...e, user_id: e.user_id ?? user?.id ?? null }))
        const { data, error } = await supabase
          .from('agenda_evenements')
          .insert(lot)
          .select()
        if (error) throw error
        resultats.push(...(data as Evenement[]))
      }

      return resultats
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements'] })
    },
  })
}

// Supprime toute une série récurrente par recurrence_groupe_id
export function useDeleteSerie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupeId: string) => {
      const { error } = await supabase
        .from('agenda_evenements')
        .delete()
        .eq('recurrence_groupe_id', groupeId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements'] })
    },
  })
}

// Marque notif_envoyee = true pour un événement
export function useMarquerNotifEnvoyee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agenda_evenements')
        .update({ notif_envoyee: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements'] })
    },
  })
}
